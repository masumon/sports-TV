from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from functools import partial

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.routes import admin, auth, live_scores, proxy, sports_tv
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.ensure_schema import ensure_channel_columns, ensure_user_subscription_tier
from app.db.session import ASYNC_URL, Base, SessionLocal, engine
from app.models import Channel, User
from app.services.automation import run_channel_health_check, run_channel_sync
from app.services.m3u_discovery import discover_new_sources

if not logging.getLogger().handlers:
    logging.basicConfig(
        level=logging.DEBUG if settings.debug else logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        stream=sys.stdout,
    )
logger = logging.getLogger("app.startup")

SCHEDULER = None


def ensure_admin_seed(db: Session) -> None:
    # Migrate legacy admin@gstv.local (invalid TLD rejected by email-validator)
    # to the configured admin email so login works after the EmailStr fix.
    legacy = db.scalar(select(User).where(User.email == "admin@gstv.local"))
    if legacy and legacy.email != settings.admin_email:
        legacy.email = settings.admin_email
        db.commit()
        logger.info("Migrated legacy admin email -> %s", settings.admin_email)

    admin = db.scalar(select(User).where(User.email == settings.admin_email))
    if admin:
        return
    db.add(
        User(
            full_name=settings.admin_full_name,
            email=settings.admin_email,
            password_hash=get_password_hash(settings.admin_password),
            is_admin=True,
            is_active=True,
        )
    )
    db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global SCHEDULER
    logger.info(
        "Starting | APP_ENV=%s | ADMIN_EMAIL=%s",
        settings.app_env,
        settings.admin_email,
    )
    Base.metadata.create_all(bind=engine)
    try:
        ensure_user_subscription_tier(engine)
        ensure_channel_columns(engine)
    except RuntimeError:
        logger.critical(
            "DB schema migration failed — login WILL return 500 until this is resolved. "
            "Run: ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free';"
        )
        # Do not abort startup — the app should still serve non-user routes.
    db = SessionLocal()
    try:
        ensure_admin_seed(db)
        needs_startup_sync = False
        if settings.auto_sync_channels_on_startup:
            existing_count = db.scalar(select(func.count()).select_from(Channel)) or 0
            if existing_count == 0:
                needs_startup_sync = True
    finally:
        db.close()

    if needs_startup_sync:
        await run_in_threadpool(partial(run_channel_sync, include_discovery=True, source="startup"))

    _needs_scheduler = (
        settings.scheduled_sync_interval_minutes > 0
        or settings.m3u8_refresh_interval_minutes > 0
        or settings.source_discovery_interval_hours > 0
    )
    if _needs_scheduler:
        from apscheduler.schedulers.background import BackgroundScheduler
        from sqlalchemy import select as _select, or_
        from app.models.dynamic_stream import DynamicStream as _DS

        def scheduled_m3u_sync() -> None:
            """Run every `scheduled_sync_interval_minutes` — fetch sources + cleanup."""
            try:
                run_channel_sync(include_discovery=True, source="scheduler")
            except Exception:
                logger.exception("Scheduled M3U sync failed")

        def scheduled_stream_validation() -> None:
            """Validate a rotating sample of active channels; deactivate dead ones."""
            try:
                run_channel_health_check(sample_limit=80, max_workers=20)
            except Exception:
                logger.exception("Scheduled stream validation failed")

        def scheduled_discovery() -> None:
            """Run every `source_discovery_interval_hours` — find new M3U sources."""
            try:
                sources = discover_new_sources()
                logger.info("Discovery scheduler: %d source(s) cached", len(sources))
            except Exception:
                logger.exception("Scheduled M3U discovery failed")

        def scheduled_m3u8_refresh() -> None:
            """Re-extract .m3u8 tokens for DynamicStream records expiring within 15 minutes.

            Runs every `m3u8_refresh_interval_minutes`.  For each active record
            whose token is absent or expires within the 15-minute safety window
            the Playwright engine is invoked.  The old URL is kept as a fallback
            so the proxy always has a valid stream to serve.

            Guarantees:
            - Never crashes the worker (all exceptions are caught).
            - Never leaves a stream with no URL (fallback preserved).
            - Closes the browser and calls gc.collect() after every extraction.
            """
            import json as _json
            from datetime import datetime, timedelta, timezone as _tz
            from app.services.playwright_extractor import extract_m3u8_from_page

            sdb = SessionLocal()
            try:
                refresh_window = datetime.now(tz=_tz.utc) + timedelta(minutes=15)
                # Select active streams with no URL yet, or whose token expires soon.
                stmt = _select(_DS).where(
                    _DS.is_active.is_(True),
                    or_(
                        _DS.m3u8_url.is_(None),
                        _DS.expires_at.is_(None),
                        _DS.expires_at <= refresh_window,
                    ),
                )
                streams = list(sdb.scalars(stmt).all())
                if not streams:
                    return

                logger.info(
                    "M3U8 refresh: %d stream(s) need re-extraction", len(streams)
                )

                for stream in streams:
                    try:
                        result = extract_m3u8_from_page(
                            stream.source_page_url,
                            token_ttl_seconds=stream.token_ttl_seconds,
                        )
                        if result is not None:
                            # Preserve previous URL as fallback before overwriting.
                            if stream.m3u8_url:
                                stream.fallback_m3u8_url = stream.m3u8_url
                                stream.fallback_headers_json = stream.headers_json
                            stream.m3u8_url = result.m3u8_url
                            stream.headers_json = _json.dumps(result.headers)
                            stream.expires_at = result.expires_at
                            stream.last_refreshed_at = datetime.now(tz=_tz.utc)
                            sdb.commit()
                            logger.info(
                                "M3U8 refresh OK: stream_id=%d expires_at=%s",
                                stream.id,
                                result.expires_at.isoformat(),
                            )
                        else:
                            logger.warning(
                                "M3U8 refresh FAILED for stream_id=%d (%s) — "
                                "fallback URL will be served",
                                stream.id,
                                stream.source_page_url[:80],
                            )
                    except Exception:
                        logger.exception(
                            "M3U8 refresh error for stream_id=%d", stream.id
                        )
                        try:
                            sdb.rollback()
                        except Exception:
                            pass
            except Exception:
                logger.exception("Scheduled M3U8 refresh job failed")
            finally:
                sdb.close()

        SCHEDULER = BackgroundScheduler()

        if settings.scheduled_sync_interval_minutes > 0:
            SCHEDULER.add_job(
                scheduled_m3u_sync,
                "interval",
                minutes=settings.scheduled_sync_interval_minutes,
                id="m3u_sync",
                max_instances=1,
                coalesce=True,
                misfire_grace_time=60,
            )
            logger.info("Scheduled M3U sync every %s min", settings.scheduled_sync_interval_minutes)

            SCHEDULER.add_job(
                scheduled_stream_validation,
                "interval",
                minutes=15,
                id="stream_validation",
                max_instances=1,
                coalesce=True,
                misfire_grace_time=60,
            )
            logger.info("Scheduled stream validation every 15 min")

        if settings.source_discovery_interval_hours > 0:
            SCHEDULER.add_job(
                scheduled_discovery,
                "interval",
                hours=settings.source_discovery_interval_hours,
                id="m3u_discovery",
                max_instances=1,
                coalesce=True,
                misfire_grace_time=60,
            )
            logger.info(
                "Scheduled M3U discovery every %sh",
                settings.source_discovery_interval_hours,
            )

        if settings.m3u8_refresh_interval_minutes > 0:
            SCHEDULER.add_job(
                scheduled_m3u8_refresh,
                "interval",
                minutes=settings.m3u8_refresh_interval_minutes,
                id="m3u8_refresh",
                max_instances=1,
                coalesce=True,
                misfire_grace_time=60,
            )
            logger.info(
                "Scheduled dynamic m3u8 refresh every %s min",
                settings.m3u8_refresh_interval_minutes,
            )

        SCHEDULER.start()
        logger.info("Background scheduler started")

    yield

    if SCHEDULER:
        SCHEDULER.shutdown(wait=False)
        logger.info("Scheduler stopped")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Global Sports Live TV backend API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def _http_exception_handler(_request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def _validation_error_handler(_request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(Exception)
async def _unhandled_error_handler(request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled: %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error" if not settings.debug else str(exc)},
    )


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.app_env, "version": "asyncpg-async-v11"}


@app.get("/health/db", tags=["health"], include_in_schema=False)
async def health_db() -> dict:
    """Diagnostic: test async DB connection and return error detail if it fails."""
    import re as _re
    from sqlalchemy import text as sa_text
    from app.db.session import AsyncSessionLocal

    # Show last 4 chars of password so we can confirm Render picked up the new value
    _pw_suffix = ""
    try:
        _m = _re.search(r":([^:@\s]+)@", str(ASYNC_URL))
        if _m:
            _pw = _m.group(1)
            if _pw and _pw != "***":
                _pw_suffix = ("*" * max(0, len(_pw) - 4)) + _pw[-4:]
            else:
                _pw_suffix = "(masked-check session.py)"
    except Exception:
        pass

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(sa_text("SELECT 1"))
        return {"db": "ok", "async_url_prefix": str(ASYNC_URL)[:40], "pw_suffix": _pw_suffix}
    except Exception as exc:
        return {"db": "error", "detail": str(exc), "async_url_prefix": str(ASYNC_URL)[:40], "pw_suffix": _pw_suffix}


@app.post("/internal/sync", tags=["internal"], include_in_schema=False)
async def internal_sync(request: Request) -> dict[str, object]:
    """Internal endpoint for scheduler/webhook triggered M3U sync.

    Protected by X-Sync-Secret header when INTERNAL_SYNC_SECRET env var is set.
    """
    import hmac as _hmac

    secret = os.environ.get("INTERNAL_SYNC_SECRET", "").strip()
    if secret:
        provided = request.headers.get("X-Sync-Secret", "")
        if not _hmac.compare_digest(provided.encode(), secret.encode()):
            raise HTTPException(status_code=403, detail="Forbidden")

    result = await run_in_threadpool(partial(run_channel_sync, include_discovery=True, source="internal"))
    return {"status": "ok", "result": result}


app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(sports_tv.router, prefix=settings.api_v1_prefix)
app.include_router(live_scores.router, prefix=settings.api_v1_prefix)
app.include_router(admin.router, prefix=settings.api_v1_prefix)
app.include_router(proxy.router, prefix=settings.api_v1_prefix)
