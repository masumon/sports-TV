from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.live_fixture import LiveFixture

logger = logging.getLogger("app.cricket_fixtures")

CRICAPI_BASE = "https://api.cricapi.com/v1"
REQUEST_TIMEOUT = 30


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
        logger.warning("CricAPI fetch failed url=%s error=%s", url, exc)
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


def sync_cricket_fixtures(db: Session, word_index: dict[str, list[int]] | None = None) -> int:
    """Fetch current cricket matches from CricAPI and upsert into live_fixtures."""
    key = (settings.cricapi_key or "").strip()
    if not key:
        return 0

    now = datetime.now(tz=timezone.utc)
    past_buf = now - timedelta(hours=8)
    ahead = now + timedelta(days=max(1, settings.live_fixtures_days_ahead))

    offset = 0
    total_upserted = 0

    while True:
        url = f"{CRICAPI_BASE}/currentMatches?apikey={key}&offset={offset}"
        data = _fetch_json(url)
        if not isinstance(data, dict) or data.get("status") != "success":
            break

        matches: list[Any] = data.get("data") or []
        if not matches:
            break

        for m in matches:
            if not isinstance(m, dict):
                continue

            mid = m.get("id")
            if not mid:
                continue

            ext = f"cricapi:{mid}"

            # Parse match time
            dt_raw = m.get("dateTimeGMT") or m.get("date")
            starts = _parse_dt_utc(str(dt_raw)) if dt_raw else None
            if starts is None:
                # Try date-only string
                date_str = m.get("date")
                if date_str:
                    try:
                        starts = datetime.strptime(str(date_str).strip(), "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    except ValueError:
                        continue
                else:
                    continue

            if starts > ahead or starts < past_buf:
                continue

            # Teams
            teams: list[str] = m.get("teams") or []
            home = str(teams[0]).strip() if len(teams) > 0 else "Team A"
            away = str(teams[1]).strip() if len(teams) > 1 else "Team B"

            # Match name is more descriptive as league_name (e.g. "India vs England, 1st Test")
            match_name = str(m.get("name") or "").strip()
            match_type = str(m.get("matchType") or "cricket").strip().upper()
            league_name = match_name or f"{home} vs {away}"

            # Status
            match_started: bool = bool(m.get("matchStarted"))
            match_ended: bool = bool(m.get("matchEnded"))
            if match_ended:
                st = "finished"
            elif match_started:
                st = "live"
            else:
                st = "scheduled" if starts > now else "live"

            # Channel suggestions via word index
            sug_json: str | None = None
            if word_index:
                scores: dict[int, int] = {}
                import re as _re
                _tok_re = _re.compile(r"[a-z0-9]{4,}", _re.I)
                tokens: set[str] = set()
                for part in (home, away, league_name):
                    for tok in _tok_re.findall(part.lower()):
                        if len(tok) >= 4:
                            tokens.add(tok)
                for tok in tokens:
                    for cid in word_index.get(tok, ()):
                        scores[cid] = scores.get(cid, 0) + 1
                ordered = sorted(scores.items(), key=lambda x: (-x[1], x[0]))
                sug = [cid for cid, _ in ordered[:8]]
                if sug:
                    sug_json = json.dumps(sug)

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
                existing.suggested_channel_ids = sug_json
            total_upserted += 1

        # Pagination: check if more pages exist
        info: dict[str, Any] = data.get("info") or {}
        total_rows = int(info.get("totalRows") or 0)
        offset_rows = int(info.get("offsetRows") or 0)
        page_size = len(matches)
        if offset_rows + page_size >= total_rows:
            break
        offset += page_size

    if total_upserted:
        logger.info("cricapi upserted=%d matches", total_upserted)
    return total_upserted
