from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes import admin, auth, live_scores, sports_tv
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import Base, SessionLocal, engine
from app.models import Channel, User
from app.services.iptv_scraper import scrape_and_sync_sports_channels

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Global Sports Live TV backend API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_admin_seed(db)
        if settings.auto_sync_channels_on_startup:
            existing_count = db.query(Channel).count()
            if existing_count == 0:
                scrape_and_sync_sports_channels(db)
    finally:
        db.close()


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(sports_tv.router, prefix=settings.api_v1_prefix)
app.include_router(live_scores.router, prefix=settings.api_v1_prefix)
app.include_router(admin.router, prefix=settings.api_v1_prefix)
