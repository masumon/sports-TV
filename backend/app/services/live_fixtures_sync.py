from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

import requests
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import engine
from app.models.channel import Channel
from app.models.live_fixture import LiveFixture
from app.services.cricket_fixtures_sync import sync_cricket_fixtures

logger = logging.getLogger("app.live_fixtures")

OPENLIGADB_BASE = "https://api.openligadb.de"
FOOTBALL_DATA_BASE = "https://api.football-data.org/v4"
REQUEST_TIMEOUT = 45


def _fetch_json(url: str, headers: dict[str, str] | None = None) -> Any | None:
    try:
        r = requests.get(url, timeout=REQUEST_TIMEOUT, headers=headers or {})
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()
    except Exception as exc:
        logger.warning("Fixture fetch failed url=%s error=%s", url[:120], exc)
        return None


_TOKEN_RE = re.compile(r"[a-z0-9]{4,}", re.I)


def _tokens(*parts: str) -> set[str]:
    out: set[str] = set()
    for p in parts:
        if not p:
            continue
        for m in _TOKEN_RE.findall(p.lower()):
            if len(m) >= 4:
                out.add(m)
    return out


def _build_channel_word_index(db: Session) -> dict[str, list[int]]:
    """Map lowercase token -> channel ids (best-effort; used only for suggestions)."""
    rows = list(
        db.execute(select(Channel.id, Channel.name).where(Channel.is_active.is_(True))).all()
    )
    index: dict[str, list[int]] = {}
    for cid, name in rows:
        if not name:
            continue
        for tok in _tokens(name):
            index.setdefault(tok, []).append(cid)
    return index


def _suggest_channel_ids(
    word_index: dict[str, list[int]],
    home: str,
    away: str,
    league: str,
    *,
    limit: int = 8,
) -> list[int]:
    scores: dict[int, int] = {}
    for tok in _tokens(home, away, league):
        for cid in word_index.get(tok, ()):
            scores[cid] = scores.get(cid, 0) + 1
    ordered = sorted(scores.items(), key=lambda x: (-x[1], x[0]))
    out: list[int] = []
    seen: set[int] = set()
    for cid, _ in ordered:
        if cid in seen:
            continue
        seen.add(cid)
        out.append(cid)
        if len(out) >= limit:
            break
    return out


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


def _derive_status(starts: datetime, api_finished: bool, *, now: datetime) -> str:
    if api_finished:
        return "finished"
    if starts <= now:
        return "live"
    return "scheduled"


def _sync_openligadb_league(db: Session, league: str, season: int, word_index: dict[str, list[int]]) -> int:
    url = f"{OPENLIGADB_BASE}/getmatchdata/{league}/{season}"
    data = _fetch_json(url)
    if data is None:
        logger.warning("openligadb: no data for league=%s season=%d — key may be invalid (UCL/Champions League is not available on OpenLigaDB; use football-data.org CL code instead)", league, season)
        return 0
    if not isinstance(data, list):
        return 0
    now = datetime.now(tz=timezone.utc)
    ahead = now + timedelta(days=max(1, settings.live_fixtures_days_ahead))
    past_buf = now - timedelta(hours=8)
    upserted = 0
    for m in data:
        if not isinstance(m, dict):
            continue
        mid = m.get("matchID")
        if mid is None:
            continue
        ext = f"{league}:{mid}"
        utc_s = m.get("matchDateTimeUTC") or m.get("matchDateTime")
        starts = _parse_dt_utc(str(utc_s)) if utc_s else None
        if starts is None:
            continue
        if starts > ahead or starts < past_buf:
            continue
        t1 = (m.get("team1") or {}) if isinstance(m.get("team1"), dict) else {}
        t2 = (m.get("team2") or {}) if isinstance(m.get("team2"), dict) else {}
        home = str(t1.get("teamName") or t1.get("shortName") or "").strip() or "Home"
        away = str(t2.get("teamName") or t2.get("shortName") or "").strip() or "Away"
        league_name = str(m.get("leagueName") or league).strip()
        finished = bool(m.get("matchIsFinished"))
        status = _derive_status(starts, finished, now=now)
        icon = t1.get("teamIconUrl") or t2.get("teamIconUrl")
        thumb = str(icon).strip() if icon else None

        sug = _suggest_channel_ids(word_index, home, away, league_name)
        sug_json = json.dumps(sug) if sug else None

        existing = db.scalar(
            select(LiveFixture).where(LiveFixture.source == "openligadb", LiveFixture.external_id == ext)
        )
        if existing is None:
            db.add(
                LiveFixture(
                    source="openligadb",
                    external_id=ext,
                    competition_key=league,
                    league_name=league_name[:240],
                    home_team=home[:200],
                    away_team=away[:200],
                    sport="Soccer",
                    starts_at_utc=starts,
                    status=status,
                    thumb_url=thumb,
                    suggested_channel_ids=sug_json,
                )
            )
        else:
            existing.league_name = league_name[:240]
            existing.home_team = home[:200]
            existing.away_team = away[:200]
            existing.starts_at_utc = starts
            existing.status = status
            existing.thumb_url = thumb
            existing.suggested_channel_ids = sug_json
        upserted += 1
    if upserted:
        logger.info("openligadb league=%s season=%d accepted_rows=%d", league, season, upserted)
    return upserted


def _sync_football_data(db: Session, word_index: dict[str, list[int]]) -> int:
    token = (settings.football_data_org_api_token or "").strip()
    if not token:
        return 0
    now = datetime.now(tz=timezone.utc)
    # Include recent past matches (up to 8 h back) so "just finished" fixtures appear
    df = (now - timedelta(hours=8)).date()
    dt_to = now.date() + timedelta(days=max(1, settings.live_fixtures_days_ahead))
    comps = (settings.football_data_competitions or "").strip() or "PL,BL1,PD,SA,FL1,WC"
    url = (
        f"{FOOTBALL_DATA_BASE}/matches?"
        f"competitions={comps}&dateFrom={df.isoformat()}&dateTo={dt_to.isoformat()}"
    )
    data = _fetch_json(url, headers={"X-Auth-Token": token})
    if not isinstance(data, dict):
        return 0
    matches = data.get("matches")
    if not isinstance(matches, list):
        return 0
    ahead = now + timedelta(days=max(1, settings.live_fixtures_days_ahead))
    past_buf = now - timedelta(hours=8)
    n = 0
    for m in matches:
        if not isinstance(m, dict):
            continue
        mid = m.get("id")
        if mid is None:
            continue
        ext = f"fd:{mid}"
        utc_s = m.get("utcDate")
        starts = _parse_dt_utc(str(utc_s)) if utc_s else None
        if starts is None:
            continue
        if starts > ahead or starts < past_buf:
            continue
        status_raw = str(m.get("status") or "").upper()
        if status_raw == "POSTPONED":
            continue
        if status_raw in {"IN_PLAY", "PAUSED"}:
            st = "live"
        elif status_raw in {"FINISHED", "AWARDED"}:
            st = "finished"
        else:
            st = _derive_status(starts, False, now=now)

        ht = m.get("homeTeam") if isinstance(m.get("homeTeam"), dict) else {}
        at = m.get("awayTeam") if isinstance(m.get("awayTeam"), dict) else {}
        home = str(ht.get("shortName") or ht.get("name") or "").strip() or "Home"
        away = str(at.get("shortName") or at.get("name") or "").strip() or "Away"
        comp = m.get("competition") if isinstance(m.get("competition"), dict) else {}
        league_name = str(comp.get("name") or "").strip() or "Football"
        comp_code = str(comp.get("code") or "").strip() or None
        crest = ht.get("crest") or at.get("crest")
        thumb = str(crest).strip() if crest else None

        sug = _suggest_channel_ids(word_index, home, away, league_name)
        sug_json = json.dumps(sug) if sug else None

        existing = db.scalar(
            select(LiveFixture).where(LiveFixture.source == "football-data.org", LiveFixture.external_id == ext)
        )
        if existing is None:
            db.add(
                LiveFixture(
                    source="football-data.org",
                    external_id=ext,
                    competition_key=(comp_code or "")[:32] or None,
                    league_name=league_name[:240],
                    home_team=home[:200],
                    away_team=away[:200],
                    sport="Soccer",
                    starts_at_utc=starts,
                    status=st,
                    thumb_url=thumb,
                    suggested_channel_ids=sug_json,
                )
            )
        else:
            existing.league_name = league_name[:240]
            existing.home_team = home[:200]
            existing.away_team = away[:200]
            existing.starts_at_utc = starts
            existing.status = st
            existing.thumb_url = thumb
            existing.suggested_channel_ids = sug_json
            existing.competition_key = (comp_code or "")[:32] or None
        n += 1
    if n:
        logger.info("football-data.org matches upserted=%d", n)
    return n


def _cleanup_stale_fixtures(db: Session) -> int:
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=3)
    res = db.execute(delete(LiveFixture).where(LiveFixture.starts_at_utc < cutoff))
    try:
        return res.rowcount or 0
    except Exception:
        return 0


def sync_live_fixtures(db: Session) -> dict[str, int]:
    """Pull real fixtures from configured providers; refresh name-based channel hints."""
    LiveFixture.__table__.create(bind=engine, checkfirst=True)
    word_index = _build_channel_word_index(db)
    total_rows = 0

    seasons_to_try = {datetime.now(tz=timezone.utc).year, datetime.now(tz=timezone.utc).year - 1}
    leagues = [x.strip() for x in (settings.openligadb_league_keys or "").split(",") if x.strip()]
    if not leagues:
        leagues = ["bl1", "bl2"]

    for league in leagues:
        for season in sorted(seasons_to_try, reverse=True):
            n = _sync_openligadb_league(db, league, season, word_index)
            if n:
                total_rows += n
                break

    total_rows += _sync_football_data(db, word_index)
    total_rows += sync_cricket_fixtures(db, word_index)

    removed = _cleanup_stale_fixtures(db)
    db.commit()

    logger.info(
        "live_fixtures sync complete touched≈%d providers=openligadb+football_data+cricket removed_old=%d",
        total_rows,
        removed,
    )
    return {"rows_touched": total_rows, "removed_stale": removed}


def run_live_fixtures_sync_standalone() -> dict[str, int]:
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        return sync_live_fixtures(db)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
