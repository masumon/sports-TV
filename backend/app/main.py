from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from functools import partial

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from starlette.middleware.gzip import GZipMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.routes import admin, auth, proxy, sports_tv, metrics, feedback
from app.api.routes import aggregator
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.ensure_schema import (
    ensure_channel_columns,
    ensure_user_password_reset_columns,
    ensure_user_subscription_tier,
)
from app.db.session import ASYNC_URL, Base, SessionLocal, engine
from app.models import Channel, LiveFixture, User
from app.services.automation import run_channel_health_check, run_channel_sync, run_live_fixtures_job
from app.services.m3u_discovery import discover_new_sources

if not logging.getLogger().handlers:
    logging.basicConfig(
        level=logging.DEBUG if settings.debug else logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        stream=sys.stdout,
    )
logger = logging.getLogger("app.startup")

SCHEDULER = None


def prune_non_default_users(db: Session) -> None:
    """Delete every user except the configured admin (ADMIN_EMAIL). Respects PRUNE_NON_DEFAULT_USERS_ON_STARTUP."""
    if not settings.prune_non_default_users_on_startup:
        return
    keep = {settings.admin_email.strip().lower()}
    q = select(User).where(
        ~func.lower(User.email).in_([*keep]),
    )
    rows = db.execute(q).scalars().all()
    n = 0
    for row in rows:
        db.delete(row)
        n += 1
    if n:
        db.commit()
        logger.info("Removed %s user row(s); kept admin only (%s)", n, settings.admin_email)


def ensure_admin_seed(db: Session) -> None:
    # Migrate legacy admin@gstv.local (invalid TLD rejected by email-validator)
    # to the configured admin email so login works after the EmailStr fix.
    legacy = db.scalar(select(User).where(User.email == "admin@gstv.local"))
    if legacy and legacy.email != settings.admin_email:
        legacy.email = settings.admin_email
        db.commit()
        logger.info("Migrated legacy admin email -> %s", settings.admin_email)

    # Many deployments still have the old seeded account admin@gstv.tv; merge into settings.admin_email.
    if settings.admin_email and settings.admin_email not in ("admin@gstv.tv", "admin@gstv.local"):
        legacy_gstv = db.scalar(select(User).where(User.email == "admin@gstv.tv"))
        if legacy_gstv:
            target = db.scalar(select(User).where(User.email == settings.admin_email))
            if target is None:
                legacy_gstv.email = settings.admin_email
                legacy_gstv.is_admin = True
                legacy_gstv.password_hash = get_password_hash(settings.admin_password)
                db.commit()
                logger.info("Migrated admin@gstv.tv -> %s (password from ADMIN_PASSWORD env)", settings.admin_email)
            elif target.id != legacy_gstv.id:
                db.delete(legacy_gstv)
                db.commit()
                logger.info("Removed stale admin@gstv.tv; use existing %s", settings.admin_email)

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

    # SECURITY: Enforce strong secrets in ALL environments
    if not settings.admin_email or not settings.admin_email.strip():
        raise RuntimeError(
            "SECURITY FATAL: ADMIN_EMAIL not set. Set ADMIN_EMAIL environment variable immediately."
        )
    if not settings.admin_password or not settings.admin_password.strip() or len(settings.admin_password) < 12:
        raise RuntimeError(
            "SECURITY FATAL: ADMIN_PASSWORD not set or too weak (min 12 chars). "
            "Set ADMIN_PASSWORD environment variable with strong password immediately."
        )
    if not settings.jwt_secret_key or not settings.jwt_secret_key.strip() or len(settings.jwt_secret_key) < 32:
        raise RuntimeError(
            "SECURITY FATAL: JWT_SECRET_KEY not set or too weak (min 32 chars). "
            "Set JWT_SECRET_KEY environment variable immediately."
        )

    # PERFORMANCE: Require Redis in production for channel caching
    _is_prod = (settings.app_env or "").lower() in {"production", "prod"}
    if _is_prod and not settings.redis_url:
        logger.warning(
            "PERFORMANCE WARNING: Redis not configured in production. "
            "Set REDIS_URL for channel list caching. Using in-memory cache (not cluster-safe)."
        )

    Base.metadata.create_all(bind=engine)
    try:
        ensure_user_subscription_tier(engine)
        ensure_channel_columns(engine)
        ensure_user_password_reset_columns(engine)
    except RuntimeError:
        logger.critical(
            "DB schema migration failed — login WILL return 500 until this is resolved. "
            "Run: ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free';"
        )
        # Do not abort startup — the app should still serve non-user routes.
    db = SessionLocal()
    try:
        ensure_admin_seed(db)
        prune_non_default_users(db)
        # Fresh/empty DB: always run one M3U sync so first deploy is not empty
        # (AUTO_SYNC_CHANNELS_ON_STARTUP alone was too easy to leave false in production).
        existing_count = db.scalar(select(func.count()).select_from(Channel)) or 0
        fixture_count = db.scalar(select(func.count()).select_from(LiveFixture)) or 0
        # Viewer home uses M3U catalog; DB sync is legacy/admin-only. Opt in with AUTO_SYNC_CHANNELS_ON_STARTUP=true.
        needs_startup_sync = existing_count == 0 and settings.auto_sync_channels_on_startup
        needs_fixture_sync = (
            fixture_count == 0
            and (settings.live_fixtures_sync_interval_minutes or 0) > 0
        )
    finally:
        db.close()

    # Auto-seed / sync helpers — defined here so the background task can close over them
    def auto_seed_channels() -> None:
        from app.services.bdix_seeder import seed_bdix_channels
        from app.services.international_seeder import seed_international_channels
        sdb = SessionLocal()
        try:
            logger.info("Auto-seeding BDIX Bangladesh channels...")
            bdix_result = seed_bdix_channels(sdb)
            logger.info(f"BDIX seed complete: {bdix_result['created']} created, {bdix_result['updated']} updated")
            logger.info("Auto-seeding International FREE sources...")
            intl_result = seed_international_channels(sdb)
            logger.info(f"International seed complete: {intl_result['created']} created, {intl_result['updated']} updated")
        except Exception as e:
            logger.warning(f"Auto-seed skipped: {e}")
        finally:
            sdb.close()

    # IMPORTANT: All heavy startup tasks run as a background asyncio task so the server
    # binds to the port immediately (fixes Render free-tier 15-min port-scan timeout).
    import asyncio as _asyncio

    async def _background_startup() -> None:
        await _asyncio.sleep(2)  # Let server fully start first
        try:
            if needs_startup_sync:
                logger.info("Background: M3U sync (empty DB + AUTO_SYNC=true)")
                await run_in_threadpool(partial(run_channel_sync, include_discovery=True, source="startup"))
            if needs_fixture_sync:
                logger.info("Background: live fixtures sync (empty table)")
                await run_in_threadpool(partial(run_live_fixtures_job, source="startup"))
            if existing_count == 0:
                logger.info("Background: channel seed (first deploy)")
                await run_in_threadpool(auto_seed_channels)
        except Exception:
            logger.exception("Background startup task failed")

    _asyncio.create_task(_background_startup())

    _needs_scheduler = (
        settings.scheduled_sync_interval_minutes > 0
        or settings.m3u8_refresh_interval_minutes > 0
        or settings.source_discovery_interval_hours > 0
        or (settings.stream_validation_interval_minutes or 0) > 0
        or (settings.live_fixtures_sync_interval_minutes or 0) > 0
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
                run_channel_health_check(
                    sample_limit=max(0, settings.stream_validation_sample_limit),
                    max_workers=5,
                    resync_on_dead=False,
                )
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
            """Re-extract .m3u8 tokens for DynamicStream records expiring within the lead window.

            Runs every `m3u8_refresh_interval_minutes`.  For each active record
            whose token is absent or expires within ``m3u8_token_refresh_lead_minutes``
            the Playwright engine is invoked.  The old URL is kept as a fallback
            so the proxy always has a valid stream to serve.

            Guarantees:
            - Never crashes the worker (all exceptions are caught).
            - Never leaves a stream with no URL (fallback preserved).
            - Closes the browser and calls gc.collect() after every extraction.
            """
            # Guard: if playwright is not installed, skip silently.
            # Set M3U8_REFRESH_INTERVAL_MINUTES=0 in env to disable this job entirely.
            try:
                import playwright as _pw  # noqa: F401
                del _pw
            except ImportError:
                logger.warning(
                    "scheduled_m3u8_refresh skipped: playwright not installed. "
                    "Set M3U8_REFRESH_INTERVAL_MINUTES=0 to disable this job."
                )
                return

            import json as _json
            from datetime import datetime, timedelta, timezone as _tz
            from app.services.playwright_extractor import extract_m3u8_from_page

            sdb = SessionLocal()
            try:
                lead = max(1, int(settings.m3u8_token_refresh_lead_minutes))
                refresh_window = datetime.now(tz=_tz.utc) + timedelta(minutes=lead)
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

        def scheduled_live_fixtures() -> None:
            try:
                run_live_fixtures_job(source="scheduler")
            except Exception:
                logger.exception("Scheduled live fixtures sync failed")

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

        if settings.stream_validation_interval_minutes and settings.stream_validation_interval_minutes > 0:
            SCHEDULER.add_job(
                scheduled_stream_validation,
                "interval",
                minutes=settings.stream_validation_interval_minutes,
                id="stream_validation",
                max_instances=1,
                coalesce=True,
                misfire_grace_time=60,
            )
            logger.info(
                "Scheduled stream validation every %s min",
                settings.stream_validation_interval_minutes,
            )

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
                # First run on deploy so tokens near expiry are refreshed without waiting one interval.
                next_run_time=datetime.now(tz=timezone.utc),
            )
            logger.info(
                "Scheduled dynamic m3u8 refresh every %s min (T-%s min lead window)",
                settings.m3u8_refresh_interval_minutes,
                max(1, settings.m3u8_token_refresh_lead_minutes),
            )

        # Enforce minimum 60min interval when no API token is set (avoids hammering OpenLigaDB at 15min cadence)
        _fixture_interval = settings.live_fixtures_sync_interval_minutes or 60
        if not (settings.football_data_org_api_token or "").strip():
            _fixture_interval = max(_fixture_interval, 60)
        if settings.live_fixtures_sync_interval_minutes and settings.live_fixtures_sync_interval_minutes > 0:
            SCHEDULER.add_job(
                scheduled_live_fixtures,
                "interval",
                minutes=_fixture_interval,
                id="live_fixtures",
                max_instances=1,
                coalesce=True,
                misfire_grace_time=120,
                # Interval jobs otherwise wait one full period after deploy/spin-up.
                next_run_time=(
                    None
                    if needs_fixture_sync  # startup task handles first sync → wait full interval
                    else datetime.now(tz=timezone.utc)
                ),
            )
            logger.info(
                "Scheduled live fixtures sync every %s min",
                settings.live_fixtures_sync_interval_minutes,
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
    docs_url=None if (settings.app_env or "").lower() in {"production", "prod"} else "/docs",
    redoc_url=None if (settings.app_env or "").lower() in {"production", "prod"} else "/redoc",
    openapi_url=None if (settings.app_env or "").lower() in {"production", "prod"} else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    # Vercel Preview: restrict to sports-tv-* prefix only (not any Vercel subdomain).
    allow_origin_regex=r"^https://sports-tv[a-zA-Z0-9-]*\.vercel\.app$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Range", "X-Sync-Secret"],
    expose_headers=["Content-Length", "Content-Range", "Accept-Ranges"],
)
# Compress JSON/text on slow mobile links (free-tier friendly; skips tiny bodies).
app.add_middleware(GZipMiddleware, minimum_size=512)


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


@app.get("/", tags=["meta"], include_in_schema=True)
def root() -> dict[str, str]:
    """Landing response when the API base URL is opened in a browser (e.g. Render)."""
    return {
        "service": settings.app_name,
        "status": "ok",
        "message": "Use /docs for OpenAPI, /health for readiness.",
        "docs": "/docs",
        "health": "/health",
        "api": settings.api_v1_prefix,
    }


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.app_env, "version": "asyncpg-async-v11"}


@app.get("/health/db", tags=["health"], include_in_schema=False)
async def health_db() -> dict:
    """Diagnostic: test async DB connection and return error detail if it fails."""
    from sqlalchemy import text as sa_text
    from app.db.session import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(sa_text("SELECT 1"))
        return {"db": "ok", "backend": str(ASYNC_URL).split(":", 1)[0]}
    except Exception as exc:
        detail = str(exc) if settings.debug else "Database connection failed"
        return {"db": "error", "detail": detail, "backend": str(ASYNC_URL).split(":", 1)[0]}


@app.get("/playlist.m3u", tags=["m3u"])
async def get_playlist_m3u(
    limit: int = 2000,
    module: str | None = None,
) -> StreamingResponse:
    """
    Generate M3U playlist from active DB channels.

    - Capped at 5000 entries for free-tier safety.
    - Streams the response line-by-line to avoid buffering large playlists in memory.
    - Includes EPG URL header (x-tvg-url) for compatible players.
    - Includes tvg-logo, tvg-id (when known), group-title per entry.
    - Optional `module` query param to filter by module slug.
    """
    from sqlalchemy import select
    from app.db.session import AsyncSessionLocal
    from app.models.channel import Channel
    from app.services.iptv_scraper import EPG_URL, lookup_epg_id

    cap = min(max(1, limit), 5000)
    try:
        async with AsyncSessionLocal() as session:
            q = select(Channel).where(Channel.is_active.is_(True))
            if module:
                q = q.where(Channel.module == module)
            q = q.order_by(Channel.updated_at.desc()).limit(cap)
            result = await session.execute(q)
            channels = list(result.scalars().all())
    except Exception as exc:
        logger.error("playlist.m3u DB error: %s", exc)
        raise HTTPException(status_code=503, detail="Database unavailable") from exc

    epg_url = getattr(settings, "epg_url", EPG_URL) or EPG_URL

    async def _generate():
        yield f'#EXTM3U x-tvg-url="{epg_url}"\n'
        for ch in channels:
            logo = f' tvg-logo="{ch.logo_url}"' if ch.logo_url else ""
            group = f' group-title="{ch.category}"' if ch.category else ""
            epg_id = lookup_epg_id(ch.name)
            tvg_id = f' tvg-id="{epg_id}"' if epg_id else ""
            tvg_name = f' tvg-name="{ch.name}"'
            yield f'#EXTINF:-1{tvg_id}{tvg_name}{logo}{group},{ch.name}\n'
            yield f'{ch.stream_url}\n'

    return StreamingResponse(
        _generate(),
        media_type="application/vnd.apple.mpegurl",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
            "Content-Disposition": "attachment; filename=playlist.m3u",
        },
    )


@app.get("/channels.json", tags=["m3u"], include_in_schema=False)
async def channels_json_redirect() -> Response:
    """Convenience alias — redirects to /api/v1/aggregator/channels.json."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(
        url=f"{settings.api_v1_prefix}/aggregator/channels.json",
        status_code=302,
    )


@app.post("/internal/sync", tags=["internal"], include_in_schema=False)
async def internal_sync(request: Request) -> dict[str, object]:
    """Internal endpoint for scheduler/webhook triggered M3U sync.

    Production: set INTERNAL_SYNC_SECRET and send the same value in X-Sync-Secret.
    """
    import hmac as _hmac

    secret = os.environ.get("INTERNAL_SYNC_SECRET", "").strip()
    is_prod = (settings.app_env or "").lower() in {"production", "prod"}
    if is_prod:
        if not secret:
            raise HTTPException(
                status_code=503,
                detail="INTERNAL_SYNC_SECRET is not configured for this environment",
            )
        provided = request.headers.get("X-Sync-Secret", "")
        if not _hmac.compare_digest(provided.encode(), secret.encode()):
            raise HTTPException(status_code=403, detail="Forbidden")
    elif secret:
        provided = request.headers.get("X-Sync-Secret", "")
        if not _hmac.compare_digest(provided.encode(), secret.encode()):
            raise HTTPException(status_code=403, detail="Forbidden")

    result = await run_in_threadpool(partial(run_channel_sync, include_discovery=True, source="internal"))
    return {"status": "ok", "result": result}


app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(sports_tv.router, prefix=settings.api_v1_prefix)
app.include_router(admin.router, prefix=settings.api_v1_prefix)
app.include_router(proxy.router, prefix=settings.api_v1_prefix)
app.include_router(aggregator.router, prefix=settings.api_v1_prefix)
app.include_router(metrics.router, prefix=settings.api_v1_prefix)  # Health + metrics endpoints
app.include_router(feedback.router, prefix=settings.api_v1_prefix)  # User feedback collection

