from __future__ import annotations

import logging
import json
from datetime import datetime, timezone
from typing import Callable, TypeVar

from sqlalchemy import select, text

from app.core.cache import invalidate_list_caches
from app.core.config import settings
from app.core.sync_rate_limit import (
    mark_sync_failure,
    mark_sync_started,
    mark_sync_success,
    mark_sweep_complete,
    try_acquire_sync_lock,
)
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


def _channel_validation_urls(channel: Channel) -> list[str]:
    urls = [channel.stream_url]
    if channel.alternate_urls:
        try:
            parsed = json.loads(channel.alternate_urls)
            if isinstance(parsed, list):
                urls.extend(str(url).strip() for url in parsed if str(url).strip())
        except Exception:
            logger.debug("Invalid alternate_urls JSON for channel_id=%s", channel.id)

    seen: set[str] = set()
    out: list[str] = []
    for url in urls:
        if not url or url in seen:
            continue
        seen.add(url)
        out.append(url)
    return out


def _dead_channels_after_fallback_validation(rows: list[Channel], max_workers: int) -> tuple[list[Channel], int]:
    # Channels with a header_profile require auth headers the validator cannot send.
    # Validating them without auth → 403 → false-negative deactivation.
    # They stay active; only removed via admin action or explicit DB update.
    rows_checkable = [ch for ch in rows if not ch.header_profile]
    skipped_count = len(rows) - len(rows_checkable)
    if skipped_count:
        logger.debug(
            "channel_health_check: skipping %d auth-profile channels (header_profile set)",
            skipped_count,
        )

    if not rows_checkable:
        return [], 0

    channel_urls = {ch.id: _channel_validation_urls(ch) for ch in rows_checkable}
    urls = sorted({url for values in channel_urls.values() for url in values})
    results = validate_stream_urls(urls, max_workers=max_workers)
    dead = [
        ch for ch in rows_checkable
        if not any(results.get(url, False) for url in channel_urls.get(ch.id, []))
    ]
    return dead, len(urls)


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
    if not try_acquire_sync_lock():
        logger.warning("channel_sync skipped source=%s reason=sync_already_running", source)
        return {"created": 0, "updated": 0, "total": 0, "skipped": 1, "status": "skipped"}
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
        parsed = result.get("parsed", 0)
        sources_ok = result.get("sources_ok", 0)
        sources_failed = result.get("sources_failed", 0)
        # Only mark success if we actually parsed channels; zero total = upstream sources all failed.
        if total == 0 and created == 0 and updated == 0:
            msg = (
                f"Sync completed but no channels were parsed ({sources_ok}/{sources_ok + sources_failed} "
                f"sources OK). Check M3U source URLs and network connectivity."
            )
            mark_sync_failure(msg, created=created, updated=updated)
            logger.warning(
                "channel_sync partial-failure source=%s duration_seconds=%.2f — "
                "no channels returned from any source (sources_ok=%s sources_failed=%s parsed=%s)",
                source,
                (datetime.now(tz=timezone.utc) - started_at).total_seconds(),
                sources_ok,
                sources_failed,
                parsed,
            )
            result["status"] = "failed"
            result["message"] = msg
        else:
            mark_sync_success(created=created, updated=updated)
            result["status"] = "success"
            result["message"] = f"Synced {created} new, {updated} updated ({total} total)."
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
        invalidate_list_caches()
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
    """Validate a rotating sample of active streams and soft-deactivate dead URLs."""
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

        dead, checked_urls = _dead_channels_after_fallback_validation(rows, max_workers=max_workers)

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
            "channel_health_check complete duration_seconds=%.2f checked=%d checked_urls=%d deactivated=%d recovered=%d",
            (datetime.now(tz=timezone.utc) - started_at).total_seconds(),
            len(rows),
            checked_urls,
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

    Soft-deactivates every channel whose primary stream_url is unreachable.
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

        dead, checked_urls = _dead_channels_after_fallback_validation(rows, max_workers=max_workers)

        for ch in dead:
            ch.is_active = False
        if dead:
            db.commit()
            invalidate_list_caches()

        elapsed = (datetime.now(tz=timezone.utc) - started_at).total_seconds()
        logger.info(
            "health_sweep complete duration_seconds=%.2f checked=%d checked_urls=%d deactivated=%d",
            elapsed,
            len(rows),
            checked_urls,
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
