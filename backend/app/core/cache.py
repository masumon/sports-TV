from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from typing import Any

from app.core.config import settings

logger = logging.getLogger("app.cache")

_redis: Any = None
_mem: dict[str, tuple[float, bytes]] = {}
_mem_lock = threading.Lock()
_cache_version = 0


def _get_redis() -> Any:
    global _redis
    if _redis is False:
        return None
    if _redis is not None:
        return _redis
    url = settings.redis_url
    if not url:
        _redis = False
        return None
    try:
        import redis as redis_mod

        r = redis_mod.from_url(url, decode_responses=False, socket_connect_timeout=2.0)
        r.ping()
        _redis = r
        logger.info("Redis cache connected")
    except Exception as e:
        logger.warning("Redis unavailable; caching disabled: %s", e)
        _redis = False
    return _redis if _redis not in (False, None) else None


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


def invalidate_list_caches() -> None:
    """Invalidate channel, filter, and live-score list caches (after sync or admin writes)."""
    global _cache_version
    r = _get_redis()
    if r:
        try:
            for k in r.scan_iter("gstv:channels:*"):
                r.delete(k)
            for k in r.scan_iter("gstv:channel_filters:*"):
                r.delete(k)
            for k in r.scan_iter("gstv:live-scores:*"):
                r.delete(k)
        except Exception as e:
            logger.warning("redis invalidate: %s", e)
    else:
        _cache_version += 1
    with _mem_lock:
        drop = [
            k for k in _mem
            if "gstv:channels:" in k or "gstv:channel_filters:" in k or "gstv:live-scores:" in k
        ]
        for k in drop:
            _mem.pop(k, None)


def _raw_get(key: str) -> bytes | None:
    r = _get_redis()
    if r:
        v = r.get(key)
        return v if v else None
    now = time.time()
    with _mem_lock:
        if key in _mem:
            exp, payload = _mem[key]
            if exp > now:
                return payload
            _mem.pop(key, None)
    return None


def _raw_set(key: str, value: bytes, ttl: int) -> None:
    r = _get_redis()
    if r:
        try:
            r.setex(key, ttl, value)
        except Exception as e:
            logger.warning("redis set: %s", e)
        return
    with _mem_lock:
        _mem[key] = (time.time() + ttl, value)
        if len(_mem) > 512:
            for k, (exp, _) in sorted(_mem.items(), key=lambda x: x[1][0])[:64]:
                _mem.pop(k, None)
