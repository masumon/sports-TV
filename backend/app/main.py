from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.routes import admin, auth, live_scores, sports_tv
from app.core.cache import invalidate_list_caches
from app.core.config import settings
from app.core.security import get_password_hash
from app.core.sync_rate_limit import mark_sync_success
from app.db.ensure_schema import ensure_user_subscription_tier
from app.db.session import Base, SessionLocal, engine
from app.models import Channel, User
from app.services.iptv_scraper import scrape_and_sync_sports_channels

if not logging.getLogger().handlers:
    logging.basicConfig(
        level=logging.DEBUG if settings.debug else logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        stream=sys.stdout,
    )
logger = logging.getLogger("app.startup")

SCHEDULER = None


def ensure_admin_seed(db: Session) -> None:
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
    ensure_user_subscription_tier(engine)
    db = SessionLocal()
    try:
        ensure_admin_seed(db)
        if settings.auto_sync_channels_on_startup:
            existing_count = db.scalar(select(func.count()).select_from(Channel)) or 0
            if existing_count == 0:
                scrape_and_sync_sports_channels(db)
                invalidate_list_caches()
    finally:
        db.close()

    if settings.scheduled_sync_interval_minutes > 0:
        from apscheduler.schedulers.background import BackgroundScheduler

        def scheduled_m3u_sync() -> None:
            sdb = SessionLocal()
            try:
                scrape_and_sync_sports_channels(sdb)
            except Exception:
                logger.exception("Scheduled M3U sync failed")
            finally:
                sdb.close()
            invalidate_list_caches()
            mark_sync_success()

        SCHEDULER = BackgroundScheduler()
        SCHEDULER.add_job(
            scheduled_m3u_sync,
            "interval",
            minutes=settings.scheduled_sync_interval_minutes,
            id="m3u_sync",
            max_instances=1,
            coalesce=True,
        )
        SCHEDULER.start()
        logger.info("Scheduled M3U sync every %s min", settings.scheduled_sync_interval_minutes)

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
    return {"status": "ok"}


app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(sports_tv.router, prefix=settings.api_v1_prefix)
app.include_router(live_scores.router, prefix=settings.api_v1_prefix)
app.include_router(admin.router, prefix=settings.api_v1_prefix)
