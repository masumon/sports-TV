from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Callable, TypeVar

from sqlalchemy import select, text

from app.core.cache import invalidate_list_caches
from app.core.config import settings
from app.core.sync_rate_limit import mark_sync_failure, mark_sync_started, mark_sync_success, mark_sweep_complete
from app.db.session import SessionLocal
from app.models.channel import Channel
from app.services.channel_cleanup import run_full_cleanup
from app.services.iptv_scraper import scrape_and_sync_sports_channels
from app.services.live_fixtures_sync import sync_live_fixtures
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
        created = result.get("created", 0)
        updated = result.get("updated", 0)
        total = result.get("total", 0)
        # Only mark success if we actually parsed channels; zero total = upstream sources all failed.
        if total == 0 and created == 0 and updated == 0:
            mark_sync_failure("Sync completed but no channels were parsed from any source. "
                              "Check M3U source URLs and network connectivity.")
            logger.warning(
                "channel_sync partial-failure source=%s duration_seconds=%.2f — "
                "no channels returned from any source",
                source,
                (datetime.now(tz=timezone.utc) - started_at).total_seconds(),
            )
        else:
            mark_sync_success()
            logger.info(
                "channel_sync success source=%s duration_seconds=%.2f created=%s updated=%s total=%s "
                "deactivated=%s duplicates_removed=%s",
                source,
                (datetime.now(tz=timezone.utc) - started_at).total_seconds(),
                created,
                updated,
                total,
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


def run_live_fixtures_job(*, source: str = "scheduler") -> dict[str, int]:
    """Fetch real match schedules into live_fixtures + refresh channel name hints."""
    started_at = datetime.now(tz=timezone.utc)
    logger.info("live_fixtures_sync start source=%s", source)
    db = SessionLocal()
    try:
        _apply_db_statement_timeout(db)

        def _do() -> dict[str, int]:
            db.rollback()
            _apply_db_statement_timeout(db)
            return sync_live_fixtures(db)

        out = _retry(_do, operation_name=f"live_fixtures[{source}]")
        logger.info(
            "live_fixtures_sync success source=%s duration_seconds=%.2f %s",
            source,
            (datetime.now(tz=timezone.utc) - started_at).total_seconds(),
            out,
        )
        return out
    except Exception as exc:
        db.rollback()
        logger.exception("live_fixtures_sync failed source=%s error=%s", source, exc)
        raise
    finally:
        db.close()


def run_channel_health_check(
    *,
    sample_limit: int = 80,
    max_workers: int = 20,
    resync_on_dead: bool = True,
) -> dict[str, int]:
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
            ).all()
        )
        if sample_limit and sample_limit > 0:
            rows = rows[:sample_limit]
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

        recovered = 0
        if dead and resync_on_dead:
            try:
                sync_result = run_channel_sync(include_discovery=True, source="healthcheck-recovery")
                recovered = int(sync_result.get("created", 0)) + int(sync_result.get("updated", 0))
            except Exception:
                logger.exception("channel_health_check recovery sync failed")

        logger.info(
            "channel_health_check complete duration_seconds=%.2f checked=%d deactivated=%d recovered=%d",
            (datetime.now(tz=timezone.utc) - started_at).total_seconds(),
            len(rows),
            len(dead),
            recovered,
        )
        return {"checked": len(rows), "deactivated": len(dead), "recovered": recovered}
    except Exception:
        db.rollback()
        logger.exception("channel_health_check failed")
        return {"checked": 0, "deactivated": 0}
    finally:
        db.close()


def run_health_sweep(*, max_workers: int = 30) -> dict[str, int]:
    """Full dead-link sweep — checks ALL active channels (no sample limit).

    Deactivates every channel whose primary stream_url is unreachable.
    Intended for manual admin triggers; too heavy for the scheduler.
    """
    started_at = datetime.now(tz=timezone.utc)
    logger.info("health_sweep start max_workers=%d", max_workers)
    db = SessionLocal()
    try:
        _apply_db_statement_timeout(db)
        rows = list(
            db.scalars(
                select(Channel).where(Channel.is_active.is_(True))
            ).all()
        )
        if not rows:
            logger.info("health_sweep skipped reason=no_active_channels")
            return {"checked": 0, "deactivated": 0}

        url_map = {ch.stream_url: ch for ch in rows}
        results = validate_stream_urls(list(url_map.keys()), max_workers=max_workers)
        dead = [ch for url, ch in url_map.items() if not results.get(url, False)]

        for ch in dead:
            ch.is_active = False
        if dead:
            db.commit()
            invalidate_list_caches()

        elapsed = (datetime.now(tz=timezone.utc) - started_at).total_seconds()
        logger.info(
            "health_sweep complete duration_seconds=%.2f checked=%d deactivated=%d",
            elapsed,
            len(rows),
            len(dead),
        )
        mark_sweep_complete(checked=len(rows), deactivated=len(dead))
        return {"checked": len(rows), "deactivated": len(dead)}
    except Exception:
        db.rollback()
        logger.exception("health_sweep failed")
        raise
    finally:
        db.close()
