from __future__ import annotations

import hashlib
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, get_current_user, get_password_hash, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    AdminPasswordResetConfirmSchema,
    AdminPasswordResetRequestSchema,
    AdminPasswordResetResponseSchema,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserRead,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger("app.auth")

# In-process rate limit for password reset (per email; fine for single Render instance)
_last_admin_password_reset_at: dict[str, float] = {}


def _hash_reset_token(raw: str) -> str:
    return hashlib.sha256(raw.strip().encode("utf-8")).hexdigest()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        full_name=payload.full_name.strip(),
        email=payload.email.strip(),
        password_hash=get_password_hash(payload.password),
        is_admin=False,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(subject=str(user.id), is_admin=user.is_admin)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(subject=str(user.id), is_admin=user.is_admin)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
async def get_me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.post("/admin/request-password-reset", response_model=AdminPasswordResetResponseSchema)
async def admin_request_password_reset(
    payload: AdminPasswordResetRequestSchema,
    db: AsyncSession = Depends(get_db),
) -> AdminPasswordResetResponseSchema:
    """Admin-only, no email server: returns a one-time token in the JSON (save it — it is not emailed)."""
    email = payload.email.strip().lower()
    now = time.monotonic()
    last = _last_admin_password_reset_at.get(email, 0.0)
    if now - last < float(settings.password_reset_rate_limit_seconds):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait a minute before requesting again.",
        )
    _last_admin_password_reset_at[email] = now

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.is_admin:
        return AdminPasswordResetResponseSchema(
            detail="If an admin account exists, use the next step. No email is sent from this server.",
            reset_token=None,
            token_expires_in_minutes=settings.password_reset_token_ttl_minutes,
        )

    raw = secrets.token_urlsafe(32)
    user.password_reset_token_hash = _hash_reset_token(raw)
    user.password_reset_expires_at = datetime.now(tz=timezone.utc) + timedelta(
        minutes=settings.password_reset_token_ttl_minutes
    )
    await db.commit()
    if settings.app_env.lower() in {"production", "prod"}:
        logger.info("Admin password reset token issued for %s (token not logged)", email)
    return AdminPasswordResetResponseSchema(
        detail="Copy the token below, then set a new password on the reset page. It is not sent by email.",
        reset_token=raw,
        token_expires_in_minutes=settings.password_reset_token_ttl_minutes,
    )


@router.post("/admin/reset-password", status_code=status.HTTP_200_OK)
async def admin_reset_password(
    payload: AdminPasswordResetConfirmSchema,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    email = payload.email.strip().lower()
    token_h = _hash_reset_token(payload.token)
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset request.")
    if not user.password_reset_token_hash or user.password_reset_token_hash != token_h:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token.")
    if not user.password_reset_expires_at or user.password_reset_expires_at < datetime.now(tz=timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token expired. Request a new one.")
    user.password_hash = get_password_hash(payload.new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    await db.commit()
    return {"detail": "Password has been updated. You can sign in with the new password."}
