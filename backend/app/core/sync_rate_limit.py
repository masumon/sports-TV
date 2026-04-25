from __future__ import annotations

import time
from datetime import datetime, timezone

from app.core.config import settings

_last_sync_at: float = 0.0
_last_sync_completed_at: float = 0.0
_last_sync_started_at: float = 0.0
_last_sync_status: str | None = None
_last_sync_error: str | None = None
_SYNC_STATE_KEY = "gstv:sync:state"


def _utc_iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def _persist_state() -> None:
    """Best-effort Redis persistence for cross-worker visibility; never raises."""
    try:
        import json
        from app.core.redis_client import safe_set

        payload = {
            "last_sync_at": get_last_sync_iso(),
            "last_sync_status": _last_sync_status,
            "last_sync_error": _last_sync_error,
            "last_sync_started_at": _utc_iso(_last_sync_started_at) if _last_sync_started_at else None,
            "last_sync_success_at": _utc_iso(_last_sync_at) if _last_sync_at else None,
        }
        safe_set(_SYNC_STATE_KEY, json.dumps(payload), ttl=86400)
    except Exception:
        pass


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
    global _last_sync_at, _last_sync_completed_at, _last_sync_status, _last_sync_error
    now = time.time()
    _last_sync_at = now
    _last_sync_completed_at = now
    _last_sync_status = "success"
    _last_sync_error = None
    _persist_state()


def mark_sync_started() -> None:
    global _last_sync_started_at, _last_sync_status, _last_sync_error
    _last_sync_started_at = time.time()
    _last_sync_status = "running"
    _last_sync_error = None
    _persist_state()


def mark_sync_failure(error: str) -> None:
    global _last_sync_completed_at, _last_sync_status, _last_sync_error
    _last_sync_completed_at = time.time()
    _last_sync_status = "failed"
    _last_sync_error = error[:500]
    _persist_state()


def get_last_sync_iso() -> str | None:
    if not _last_sync_completed_at:
        return None
    return _utc_iso(_last_sync_completed_at)


def get_last_sync_status() -> str | None:
    return _last_sync_status


def get_last_sync_error() -> str | None:
    return _last_sync_error
