from __future__ import annotations

import time
from datetime import datetime, timezone
from threading import Lock

from app.core.config import settings

_last_sync_at: float = 0.0
_last_sync_completed_at: float = 0.0
_last_sync_started_at: float = 0.0
_last_sync_status: str | None = None
_last_sync_error: str | None = None
_last_sync_created: int = 0
_last_sync_updated: int = 0
_SYNC_STATE_KEY = "gstv:sync:state"
_sync_lock = Lock()
_sync_running = False

# Health sweep state (in-memory; best-effort Redis persistence)
_last_sweep_at: float = 0.0
_last_sweep_checked: int = 0
_last_sweep_deactivated: int = 0
_SWEEP_STATE_KEY = "gstv:sweep:state"


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
            "last_sync_created": _last_sync_created,
            "last_sync_updated": _last_sync_updated,
            "last_sync_started_at": _utc_iso(_last_sync_started_at) if _last_sync_started_at else None,
            "last_sync_success_at": _utc_iso(_last_sync_at) if _last_sync_at else None,
        }
        safe_set(_SYNC_STATE_KEY, json.dumps(payload), ttl=86400)
    except Exception:
        pass


def _persist_sweep_state() -> None:
    try:
        import json
        from app.core.redis_client import safe_set

        payload = {
            "last_sweep_at": _utc_iso(_last_sweep_at) if _last_sweep_at else None,
            "last_sweep_checked": _last_sweep_checked,
            "last_sweep_deactivated": _last_sweep_deactivated,
        }
        safe_set(_SWEEP_STATE_KEY, json.dumps(payload), ttl=86400)
    except Exception:
        pass


_REDIS_SYNC_LOCK_KEY = "gstv:sync:running"
_REDIS_SYNC_LOCK_TTL = 360  # seconds — auto-expires if worker dies mid-sync


def _try_acquire_redis_sync_lock() -> bool | None:
    """Return True/False when Redis is available, None when unavailable."""
    try:
        from app.core.redis_client import get_shared_redis

        redis = get_shared_redis()
        if redis is None:
            return None
        return bool(redis.set(_REDIS_SYNC_LOCK_KEY, "1", ex=_REDIS_SYNC_LOCK_TTL, nx=True))
    except Exception:
        return None


def _acquire_local_sync_lock() -> bool:
    global _sync_running
    with _sync_lock:
        if _sync_running:
            return False
        _sync_running = True
        return True


def _release_local_sync_lock() -> None:
    global _sync_running
    with _sync_lock:
        _sync_running = False


def _sync_rate_limited(now: float) -> bool:
    return bool(_last_sync_at and (now - _last_sync_at) < settings.sync_rate_limit_seconds)


def check_sync_allowed() -> None:
    """Raises HTTPException 429 if a sync is already running or rate-limited.

    Uses Redis distributed lock when available so multiple Render workers
    (or concurrent admin clicks) cannot trigger duplicate syncs simultaneously.
    Falls back to in-process timestamp check when Redis is absent.
    """
    from fastapi import HTTPException, status
    from app.core.redis_client import safe_delete

    redis_acquired = _try_acquire_redis_sync_lock()
    local_acquired = False
    if redis_acquired is False:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Sync already running on this server. Please wait for it to complete.",
        )
    if redis_acquired is None:
        local_acquired = _acquire_local_sync_lock()
        if not local_acquired:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Sync already running on this server. Please wait for it to complete.",
            )

    # In-process rate limit fallback.
    now = time.time()
    if _sync_rate_limited(now):
        if redis_acquired:
            safe_delete(_REDIS_SYNC_LOCK_KEY)
        if local_acquired:
            _release_local_sync_lock()
        retry = int(settings.sync_rate_limit_seconds - (now - _last_sync_at)) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Sync rate limited. Retry after ~{retry}s.",
        )


def try_acquire_sync_lock() -> bool:
    """Best-effort sync lock for non-HTTP callers such as schedulers.

    Returns False when Redis reports another sync is already running. If Redis is
    unavailable, returns True so local/dev environments keep working.
    """
    redis_acquired = _try_acquire_redis_sync_lock()
    local_acquired = False
    if redis_acquired is False:
        return False
    if redis_acquired is None:
        local_acquired = _acquire_local_sync_lock()
        if not local_acquired:
            return False
    if _sync_rate_limited(time.time()):
        if redis_acquired:
            _release_sync_lock()
        elif local_acquired:
            _release_local_sync_lock()
        return False
    return True


def _release_sync_lock() -> None:
    try:
        from app.core.redis_client import safe_delete
        safe_delete(_REDIS_SYNC_LOCK_KEY)
    except Exception:
        pass
    _release_local_sync_lock()


def mark_sync_success(*, created: int = 0, updated: int = 0) -> None:
    global _last_sync_at, _last_sync_completed_at, _last_sync_status, _last_sync_error
    global _last_sync_created, _last_sync_updated
    now = time.time()
    _last_sync_at = now
    _last_sync_completed_at = now
    _last_sync_status = "success"
    _last_sync_error = None
    _last_sync_created = created
    _last_sync_updated = updated
    _release_sync_lock()
    _persist_state()


def mark_sync_started() -> None:
    global _last_sync_started_at, _last_sync_status, _last_sync_error
    _last_sync_started_at = time.time()
    _last_sync_status = "running"
    _last_sync_error = None
    _persist_state()


def mark_sync_failure(error: str, *, created: int = 0, updated: int = 0) -> None:
    global _last_sync_completed_at, _last_sync_status, _last_sync_error
    global _last_sync_created, _last_sync_updated
    _last_sync_completed_at = time.time()
    _last_sync_status = "failed"
    _last_sync_error = error[:500]
    _last_sync_created = created
    _last_sync_updated = updated
    _release_sync_lock()
    _persist_state()


def get_last_sync_iso() -> str | None:
    if not _last_sync_completed_at:
        return None
    return _utc_iso(_last_sync_completed_at)


def get_last_sync_status() -> str | None:
    return _last_sync_status


def get_last_sync_error() -> str | None:
    return _last_sync_error


def get_last_sync_created() -> int:
    return _last_sync_created


def get_last_sync_updated() -> int:
    return _last_sync_updated


# ── Health sweep state accessors ────────────────────────────────────────────

def mark_sweep_complete(checked: int, deactivated: int) -> None:
    global _last_sweep_at, _last_sweep_checked, _last_sweep_deactivated
    _last_sweep_at = time.time()
    _last_sweep_checked = checked
    _last_sweep_deactivated = deactivated
    _persist_sweep_state()


def get_last_sweep_iso() -> str | None:
    return _utc_iso(_last_sweep_at) if _last_sweep_at else None


def get_last_sweep_checked() -> int:
    return _last_sweep_checked


def get_last_sweep_deactivated() -> int:
    return _last_sweep_deactivated

