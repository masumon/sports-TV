from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import requests
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import engine
from app.models.live_fixture import LiveFixture

logger = logging.getLogger("app.cricket_fixtures")

CRICAPI_BASE = "https://api.cricapi.com/v1"
REQUEST_TIMEOUT = 30
_TOKEN_RE = re.compile(r"[a-z0-9]{4,}", re.I)


def _redact_key(url: str) -> str:
    return re.sub(r"(apikey=)[^&]+", r"\1***", url)


def _fetch_json(url: str) -> Any | None:
    try:
        r = requests.get(url, timeout=REQUEST_TIMEOUT)
        if r.status_code in {401, 403}:
            logger.warning("CricAPI auth error (check CRICAPI_KEY) status=%d", r.status_code)
            return None
        if r.status_code == 429:
            logger.warning("CricAPI daily quota exhausted (100 calls/day on free tier)")
            return None
        r.raise_for_status()
        return r.json()
    except Exception as exc:
        logger.warning("CricAPI fetch failed url=%s error=%s", _redact_key(url), exc)
        return None


def _parse_dt_utc(iso_s: str | None) -> datetime | None:
    if not iso_s:
        return None
    s = iso_s.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _format_cricapi_score(m: dict[str, Any]) -> str | None:
    score = m.get("score")
    if not isinstance(score, list) or not score:
        return None
    parts: list[str] = []
    for inning in score:
        if not isinstance(inning, dict):
            continue
        r = inning.get("r")
        w = inning.get("w")
        o = inning.get("o")
        inn = str(inning.get("inning") or "").strip()
        if r is None:
            continue
        seg = f"{r}/{w}" if w is not None else str(r)
        if o:
            seg += f" ({o} ov)"
        parts.append(f"{inn}: {seg}" if inn else seg)
    return " · ".join(parts) if parts else None


def _derive_status(starts: datetime, match_started: bool, match_ended: bool, *, now: datetime) -> str:
    if match_ended:
        return "finished"
    if match_started:
        return "live"
    return "scheduled" if starts > now else "live"


def _suggest_from_index(
    word_index: dict[str, list[int]] | None,
    home: str,
    away: str,
    league_name: str,
) -> str | None:
    if not word_index:
        return None
    scores: dict[int, int] = {}
    tokens: set[str] = set()
    for part in (home, away, league_name):
        for tok in _TOKEN_RE.findall(part.lower()):
            if len(tok) >= 4:
                tokens.add(tok)
    for tok in tokens:
        for cid in word_index.get(tok, ()):
            scores[cid] = scores.get(cid, 0) + 1
    ordered = sorted(scores.items(), key=lambda x: (-x[1], x[0]))
    sug = [cid for cid, _ in ordered[:8]]
    return json.dumps(sug) if sug else None


def _parse_match_row(
    m: dict[str, Any],
    *,
    now: datetime,
    past_buf: datetime,
    ahead: datetime,
    score_override: str | None = None,
) -> tuple[str, str, str, str, str, datetime, str, str | None, str] | None:
    """Return upsert fields or None if outside window / invalid."""
    mid = m.get("id")
    if not mid:
        return None

    dt_raw = m.get("dateTimeGMT") or m.get("date")
    starts = _parse_dt_utc(str(dt_raw)) if dt_raw else None
    if starts is None:
        date_str = m.get("date")
        if date_str:
            try:
                starts = datetime.strptime(str(date_str).strip()[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                return None
        else:
            return None

    if starts > ahead or starts < past_buf:
        return None

    teams: list[str] = m.get("teams") or []
    home = str(teams[0]).strip() if len(teams) > 0 else "Team A"
    away = str(teams[1]).strip() if len(teams) > 1 else "Team B"

    match_name = str(m.get("name") or "").strip()
    match_type = str(m.get("matchType") or "cricket").strip().upper()
    league_name = match_name or f"{home} vs {away}"

    match_started = bool(m.get("matchStarted"))
    match_ended = bool(m.get("matchEnded"))
    st = _derive_status(starts, match_started, match_ended, now=now)
    score_text = score_override or _format_cricapi_score(m)

    ext = f"cricapi:{mid}"
    return ext, home, away, league_name, match_type, starts, st, score_text, ext


def _upsert_row(
    db: Session,
    ext: str,
    home: str,
    away: str,
    league_name: str,
    match_type: str,
    starts: datetime,
    st: str,
    score_text: str | None,
    sug_json: str | None,
) -> None:
    existing = db.scalar(
        select(LiveFixture).where(
            LiveFixture.source == "cricapi",
            LiveFixture.external_id == ext,
        )
    )
    if existing is None:
        db.add(
            LiveFixture(
                source="cricapi",
                external_id=ext,
                competition_key=match_type[:32],
                league_name=league_name[:240],
                home_team=home[:200],
                away_team=away[:200],
                sport="Cricket",
                starts_at_utc=starts,
                status=st,
                score_text=(score_text or "")[:96] or None,
                thumb_url=None,
                suggested_channel_ids=sug_json,
            )
        )
    else:
        existing.league_name = league_name[:240]
        existing.home_team = home[:200]
        existing.away_team = away[:200]
        existing.starts_at_utc = starts
        existing.status = st
        if score_text:
            existing.score_text = score_text[:96]
        existing.suggested_channel_ids = sug_json


def _fetch_paginated(endpoint: str, key: str, max_pages: int) -> list[dict[str, Any]]:
    """Fetch up to max_pages from a CricAPI list endpoint."""
    out: list[dict[str, Any]] = []
    offset = 0
    for _page in range(max_pages):
        qs = urlencode({"apikey": key, "offset": offset})
        url = f"{CRICAPI_BASE}/{endpoint}?{qs}"
        data = _fetch_json(url)
        if not isinstance(data, dict) or data.get("status") != "success":
            if _page == 0:
                reason = data.get("reason") if isinstance(data, dict) else "no response"
                logger.warning("CricAPI %s failed: %s", endpoint, reason)
            break

        batch: list[Any] = data.get("data") or data.get("matches") or []
        if not batch:
            break
        for item in batch:
            if isinstance(item, dict):
                out.append(item)

        info: dict[str, Any] = data.get("info") or {}
        total_rows = int(info.get("totalRows") or 0)
        offset_rows = int(info.get("offsetRows") or 0)
        page_size = len(batch)
        if total_rows and offset_rows + page_size >= total_rows:
            break
        if page_size == 0:
            break
        offset += page_size
    return out


def sync_cricket_fixtures(db: Session, word_index: dict[str, list[int]] | None = None) -> int:
    """Fetch cricket matches from CricAPI /matches (+ /currentMatches for live scores) and upsert."""
    key = (settings.cricapi_key or "").strip()
    if not key:
        return 0

    now = datetime.now(tz=timezone.utc)
    hours_back = max(0, settings.live_fixtures_hours_back)
    past_buf = now - timedelta(hours=hours_back)
    ahead = now + timedelta(days=max(1, settings.live_fixtures_days_ahead))
    max_pages = max(1, settings.cricapi_max_pages)

    # Live scores keyed by match id (from currentMatches — 1 API call).
    live_scores: dict[str, str] = {}
    live_rows = _fetch_paginated("currentMatches", key, max_pages=1)
    for m in live_rows:
        mid = m.get("id")
        if not mid:
            continue
        sc = _format_cricapi_score(m)
        if sc:
            live_scores[str(mid)] = sc

    # Primary schedule source: /matches includes upcoming + recent (not just live).
    schedule_pages = max(1, max_pages - 1) if live_rows else max_pages
    schedule_rows = _fetch_paginated("matches", key, max_pages=schedule_pages)

    # Merge: schedule rows + any live-only rows not already in schedule.
    seen_ids: set[str] = set()
    merged: list[dict[str, Any]] = []
    for m in schedule_rows + live_rows:
        mid = m.get("id")
        if not mid or str(mid) in seen_ids:
            continue
        seen_ids.add(str(mid))
        merged.append(m)

    total_upserted = 0
    for m in merged:
        mid = str(m.get("id") or "")
        parsed = _parse_match_row(
            m,
            now=now,
            past_buf=past_buf,
            ahead=ahead,
            score_override=live_scores.get(mid),
        )
        if parsed is None:
            continue
        ext, home, away, league_name, match_type, starts, st, score_text, _ = parsed
        sug_json = _suggest_from_index(word_index, home, away, league_name)
        _upsert_row(db, ext, home, away, league_name, match_type, starts, st, score_text, sug_json)
        total_upserted += 1

    if total_upserted:
        logger.info(
            "cricapi upserted=%d matches (schedule=%d live=%d api_calls≈%d)",
            total_upserted,
            len(schedule_rows),
            len(live_rows),
            (1 if live_rows else 0) + schedule_pages,
        )
    elif merged:
        logger.info(
            "cricapi fetched %d rows but none in window (past %dh → +%dd)",
            len(merged),
            hours_back,
            settings.live_fixtures_days_ahead,
        )
    return total_upserted


def ensure_score_text_column() -> None:
    """Add score_text column on existing deployments (no Alembic)."""
    try:
        insp = inspect(engine)
        if "live_fixtures" not in insp.get_table_names():
            return
        cols = {c["name"] for c in insp.get_columns("live_fixtures")}
        if "score_text" in cols:
            return
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE live_fixtures ADD COLUMN score_text VARCHAR(96)"))
        logger.info("live_fixtures: added score_text column")
    except Exception as exc:
        logger.warning("live_fixtures score_text migration skipped: %s", exc)
