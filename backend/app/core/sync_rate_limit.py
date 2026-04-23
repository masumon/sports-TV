from __future__ import annotations

import time
from datetime import datetime, timezone

from app.core.config import settings

_last_sync_at: float = 0.0


def check_sync_allowed() -> None:
    """Raises HTTPException 429 if called too soon after previous successful sync."""
    from fastapi import HTTPException, status

    global _last_sync_at
    now = time.time()
    if _last_sync_at and (now - _last_sync_at) < settings.sync_rate_limit_seconds:
        retry = int(settings.sync_rate_limit_seconds - (now - _last_sync_at)) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Sync rate limited. Retry after ~{retry}s.",
        )


def mark_sync_success() -> None:
    global _last_sync_at
    _last_sync_at = time.time()


def get_last_sync_iso() -> str | None:
    if not _last_sync_at:
        return None
    return datetime.fromtimestamp(_last_sync_at, tz=timezone.utc).isoformat()
