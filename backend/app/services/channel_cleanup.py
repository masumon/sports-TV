"""
Auto-Clean Engine  (Phase 7 + 8)

Removes dead links and stale channels without breaking the DB schema.

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
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.channel import Channel

logger = logging.getLogger("app.cleanup")


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
    cutoff = datetime.now(tz=timezone.utc).replace(tzinfo=None) - __import__("datetime").timedelta(days=stale_days)

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
    Keeps the most recently updated row and deletes the rest.
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
        for ch in rows[1:]:   # keep rows[0] (newest), delete the rest
            db.delete(ch)
            removed += 1

    if removed:
        db.commit()
        logger.info("Cleanup: removed %d duplicate channel row(s)", removed)

    return {"duplicates_removed": removed}


def run_full_cleanup(db: Session, stale_days: int = 3) -> dict[str, int]:
    """Run all cleanup routines and return combined stats."""
    stale_stats = cleanup_stale_channels(db, stale_days=stale_days)
    dupe_stats = remove_duplicate_channels(db)
    return {**stale_stats, **dupe_stats}
