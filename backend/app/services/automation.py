from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Callable, TypeVar

from sqlalchemy import select, text

from app.core.cache import invalidate_list_caches
from app.core.config import settings
from app.core.sync_rate_limit import mark_sync_failure, mark_sync_started, mark_sync_success
from app.db.session import SessionLocal
from app.models.channel import Channel
from app.services.channel_cleanup import run_full_cleanup
from app.services.iptv_scraper import scrape_and_sync_sports_channels
from app.services.m3u_discovery import get_cached_discovered_sources
from app.services.stream_validator import validate_stream_urls

logger = logging.getLogger("app.automation")

T = TypeVar("T")
SYNC_RETRY_DELAYS_SECONDS: tuple[int, ...] = (1, 2, 4, 8)
MAX_SYNC_ATTEMPTS = 5
DB_STATEMENT_TIMEOUT_MS = 60_000


def _apply_db_statement_timeout(db) -> None:
    """Best-effort PostgreSQL timeout guard; unsupported dialects skip safely."""
    try:
        if db.bind is not None and db.bind.dialect.name == "postgresql":
            db.execute(text(f"SET statement_timeout = {DB_STATEMENT_TIMEOUT_MS}"))
    except Exception:
        logger.debug("DB statement timeout setup skipped", exc_info=True)


def _retry(operation: Callable[[], T], *, operation_name: str) -> T:
    last_exc: Exception | None = None
    for attempt in range(1, MAX_SYNC_ATTEMPTS + 1):
        try:
            return operation()
        except Exception as exc:
            last_exc = exc
            if attempt >= MAX_SYNC_ATTEMPTS:
                break
            delay = SYNC_RETRY_DELAYS_SECONDS[min(attempt - 1, len(SYNC_RETRY_DELAYS_SECONDS) - 1)]
            logger.warning(
                "%s retry scheduled attempt=%d/%d delay=%ss error=%s",
                operation_name,
                attempt + 1,
                MAX_SYNC_ATTEMPTS,
                delay,
                exc,
            )
            import time

            time.sleep(delay)
    raise RuntimeError(f"{operation_name} failed after {MAX_SYNC_ATTEMPTS} attempts") from last_exc


def run_channel_sync(*, include_discovery: bool = True, source: str = "scheduler") -> dict[str, int]:
    """Run the full channel sync pipeline with state tracking and cleanup.

    This function is intentionally synchronous so APScheduler can run it in its
    background worker thread and async routes can dispatch it via run_in_threadpool.
    """
    started_at = datetime.now(tz=timezone.utc)
    logger.info("channel_sync start source=%s started_at=%s", source, started_at.isoformat())
    mark_sync_started()

    db = SessionLocal()
    try:
        _apply_db_statement_timeout(db)

        def _do_sync() -> dict[str, int]:
            db.rollback()
            _apply_db_statement_timeout(db)
            discovered = get_cached_discovered_sources() if include_discovery else []
            result = scrape_and_sync_sports_channels(db, extra_urls=discovered or None)
            cleanup = run_full_cleanup(db, stale_days=settings.channel_stale_days)
            result.update(cleanup)
            return result

        result = _retry(_do_sync, operation_name=f"channel_sync[{source}]")
        invalidate_list_caches()
        mark_sync_success()
        logger.info(
            "channel_sync success source=%s duration_seconds=%.2f created=%s updated=%s total=%s "
            "deactivated=%s duplicates_removed=%s",
            source,
            (datetime.now(tz=timezone.utc) - started_at).total_seconds(),
            result.get("created", 0),
            result.get("updated", 0),
            result.get("total", 0),
            result.get("deactivated", 0),
            result.get("duplicates_removed", 0),
        )
        return result
    except Exception as exc:
        db.rollback()
        mark_sync_failure(str(exc))
        logger.exception("channel_sync failed source=%s error=%s", source, exc)
        raise
    finally:
        db.close()


def run_channel_health_check(*, sample_limit: int = 80, max_workers: int = 20) -> dict[str, int]:
    """Validate a rotating sample of active streams and deactivate dead URLs."""
    started_at = datetime.now(tz=timezone.utc)
    logger.info(
        "channel_health_check start sample_limit=%d max_workers=%d",
        sample_limit,
        max_workers,
    )
    db = SessionLocal()
    try:
        _apply_db_statement_timeout(db)
        rows = list(
            db.scalars(
                select(Channel)
                .where(Channel.is_active.is_(True))
                .order_by(Channel.updated_at.asc())
                .limit(sample_limit)
            ).all()
        )
        if not rows:
            logger.info("channel_health_check skipped reason=no_active_channels")
            return {"checked": 0, "deactivated": 0}

        url_map = {ch.stream_url: ch for ch in rows}
        results = validate_stream_urls(list(url_map.keys()), max_workers=max_workers)
        dead = [ch for url, ch in url_map.items() if not results.get(url, False)]

        for channel in dead:
            channel.is_active = False
        if dead:
            db.commit()
            invalidate_list_caches()

        logger.info(
            "channel_health_check complete duration_seconds=%.2f checked=%d deactivated=%d",
            (datetime.now(tz=timezone.utc) - started_at).total_seconds(),
            len(rows),
            len(dead),
        )
        return {"checked": len(rows), "deactivated": len(dead)}
    except Exception:
        db.rollback()
        logger.exception("channel_health_check failed")
        return {"checked": 0, "deactivated": 0}
    finally:
        db.close()
