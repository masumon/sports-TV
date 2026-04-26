from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from typing import Any

from app.core.config import settings
from app.core.redis_client import get_shared_redis

logger = logging.getLogger("app.cache")

_mem: dict[str, tuple[float, bytes]] = {}
_mem_lock = threading.Lock()
_cache_version = 0


def _params_hash(params: dict[str, Any]) -> str:
    canonical = json.dumps(params, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()[:24]


def cache_get_json(prefix: str, params: dict[str, Any]) -> Any | None:
    key = f"gstv:{prefix}:v{_cache_version}:{_params_hash(params)}"
    raw = _raw_get(key)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def cache_set_json(prefix: str, params: dict[str, Any], data: Any, ttl: int | None = None) -> None:
    key = f"gstv:{prefix}:v{_cache_version}:{_params_hash(params)}"
    ttl = ttl if ttl is not None else settings.cache_ttl_seconds
    _raw_set(key, json.dumps(data, default=str).encode("utf-8"), ttl)


# Cache key prefixes that should be cleared together after channel sync or admin writes.
_INVALIDATE_PREFIXES: tuple[str, ...] = (
    "gstv:channels:",
    "gstv:channel_filters:",
)


def invalidate_list_caches() -> None:
    """Invalidate channel and filter list caches (after sync or admin writes)."""
    global _cache_version
    r = get_shared_redis()
    if r:
        try:
            for prefix in _INVALIDATE_PREFIXES:
                for k in r.scan_iter(f"{prefix}*"):
                    r.delete(k)
        except Exception as e:
            logger.warning("redis invalidate: %s", e)
    else:
        _cache_version += 1
    with _mem_lock:
        drop = [k for k in _mem if any(k.startswith(p) for p in _INVALIDATE_PREFIXES)]
        for k in drop:
            _mem.pop(k, None)


def _raw_get(key: str) -> str | None:
    r = get_shared_redis()
    if r:
        v: str | None = r.get(key)
        return v if v else None
    now = time.time()
    with _mem_lock:
        if key in _mem:
            exp, payload = _mem[key]
            if exp > now:
                return payload.decode("utf-8", errors="replace")
            _mem.pop(key, None)
    return None


def _raw_set(key: str, value: bytes, ttl: int) -> None:
    r = get_shared_redis()
    if r:
        try:
            r.setex(key, ttl, value.decode("utf-8"))
        except Exception as e:
            logger.warning("redis set: %s", e)
        return
    with _mem_lock:
        _mem[key] = (time.time() + ttl, value)
        if len(_mem) > 512:
            for k, (exp, _) in sorted(_mem.items(), key=lambda x: x[1][0])[:64]:
                _mem.pop(k, None)
