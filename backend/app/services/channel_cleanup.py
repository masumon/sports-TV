"""
Auto-Clean Engine  (Phase 7 + 8)

Soft-deactivates dead links and stale channels without breaking the DB schema.

Safe strategy:
- Channels synced from iptv-org get their `updated_at` bumped during every
  sync (SQLAlchemy fires an UPDATE if any field changes, or we explicitly
  touch `updated_at`).
- A channel that disappears from all M3U sources will stop being refreshed.
- After `stale_days` days without a refresh we deactivate it.
- Manual channels (source != 'iptv-org') are never touched.
"""
from __future__ import annotations

import logging
import json
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.channel import Channel

logger = logging.getLogger("app.cleanup")

_CHAN_NORM_RE = re.compile(
    r"\s*[\[\(]"
    r"(?:\d{3,4}p|fhd|uhd|4k|hd|sd|geo[\s\-]?block(?:ed)?|"
    r"stream\s*\d*|backup\s*\d*|mirror\s*\d*|alt\s*\d*|live|auto|main|primary)"
    r"[\]\)]\s*",
    re.IGNORECASE,
)
_CHAN_SUFFIX_NORM_RE = re.compile(
    r"\s+(?:\d{3,4}p|fhd|uhd|4k|hd|sd|live|auto|main|primary)\s*$",
    re.IGNORECASE,
)


def _normalize_channel_name(name: str) -> str:
    cleaned = _CHAN_NORM_RE.sub(" ", name or "")
    cleaned = _CHAN_SUFFIX_NORM_RE.sub(" ", cleaned)
    return " ".join(cleaned.lower().split()).strip()


def _decode_alternate_urls(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except Exception:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(url).strip() for url in parsed if str(url).strip()]


def _merge_alternate_urls(primary_url: str, existing_raw: str | None, extra_urls: list[str]) -> str | None:
    seen = {primary_url}
    merged: list[str] = []
    for url in [*_decode_alternate_urls(existing_raw), *extra_urls]:
        if not url or url in seen:
            continue
        seen.add(url)
        merged.append(url)
    return json.dumps(merged) if merged else None


def cleanup_stale_channels(
    db: Session,
    stale_days: int = 3,
) -> dict[str, int]:
    """
    Deactivate iptv-org channels that have not been refreshed in ``stale_days`` days.

    A channel's ``updated_at`` is bumped during ``sync_channels_from_entries``
    (the scraper explicitly sets updated_at=utcnow() for every channel it sees).
    If a channel disappears from the M3U sources, its timestamp stops advancing
    and this function deactivates it after the grace period.

    Only touches source='iptv-org' channels — never manual entries.
    """
    cutoff = datetime.now(tz=timezone.utc).replace(tzinfo=None) - timedelta(days=stale_days)

    stmt = (
        select(Channel)
        .where(Channel.is_active.is_(True))
        .where(Channel.source == "iptv-org")
        .where(Channel.updated_at < cutoff)
    )
    stale = list(db.scalars(stmt).all())

    deactivated = 0
    for ch in stale:
        ch.is_active = False
        deactivated += 1

    if deactivated:
        db.commit()
        logger.info(
            "Cleanup: deactivated %d stale channel(s) (not seen in M3U for %d+ day(s))",
            deactivated,
            stale_days,
        )

    return {"deactivated": deactivated}


def remove_duplicate_channels(db: Session) -> dict[str, int]:
    """
    Safety net: find rows sharing a stream_url (should not exist due to the
    unique constraint, but can appear after manual inserts or race conditions).
    Keeps the most recently updated row active and soft-deactivates the rest.
    """
    # Find stream_urls with more than one row
    dup_q = (
        select(Channel.stream_url)
        .group_by(Channel.stream_url)
        .having(func.count(Channel.id) > 1)
    )
    dup_urls = list(db.scalars(dup_q).all())
    removed = 0

    for url in dup_urls:
        rows = list(
            db.scalars(
                select(Channel)
                .where(Channel.stream_url == url)
                .order_by(Channel.updated_at.desc())
            ).all()
        )
        for ch in rows[1:]:   # keep rows[0] (newest), deactivate the rest
            ch.is_active = False
            removed += 1

    if removed:
        db.commit()
        logger.info("Cleanup: deactivated %d duplicate channel row(s)", removed)

    return {"duplicates_removed": removed}


def deactivate_duplicate_channel_names(db: Session) -> dict[str, int]:
    """
    Soft-deactivate duplicate scraper-managed rows with the same module and
    normalized name. The scraper already merges these during sync; this repairs
    older rows without physically deleting data.
    """
    rows = list(
        db.scalars(
            select(Channel)
            .where(Channel.is_active.is_(True))
            .where(Channel.source.in_(("iptv-org", "bdix")))
            .order_by(Channel.module.asc(), Channel.updated_at.desc())
        ).all()
    )
    seen: set[tuple[str, str]] = set()
    keepers: dict[tuple[str, str], Channel] = {}
    deactivated = 0
    for ch in rows:
        norm = _normalize_channel_name(ch.name)
        if not norm:
            continue
        key = (ch.module, norm)
        if key in seen:
            keeper = keepers[key]
            keeper.alternate_urls = _merge_alternate_urls(
                keeper.stream_url,
                keeper.alternate_urls,
                [ch.stream_url, *_decode_alternate_urls(ch.alternate_urls)],
            )
            ch.is_active = False
            deactivated += 1
            continue
        seen.add(key)
        keepers[key] = ch

    if deactivated:
        db.commit()
        logger.info("Cleanup: deactivated %d duplicate channel name row(s)", deactivated)

    return {"name_duplicates_deactivated": deactivated}


def run_full_cleanup(db: Session, stale_days: int = 3) -> dict[str, int]:
    """Run all cleanup routines and return combined stats."""
    stale_stats = cleanup_stale_channels(db, stale_days=stale_days)
    dupe_stats = remove_duplicate_channels(db)
    name_dupe_stats = deactivate_duplicate_channel_names(db)
    return {**stale_stats, **dupe_stats, **name_dupe_stats}
