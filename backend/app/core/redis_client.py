"""
Redis Cloud client — optional, non-blocking, SSL-aware.

Reads connection string ONLY from environment variable REDIS_URL.
If Redis is down or the variable is absent, every safe_* function
returns a safe fallback and logs a warning. The rest of the system
is NEVER affected.

Do NOT hardcode credentials here. Set the env var on Render:
    REDIS_URL=rediss://default:<password>@<host>:<port>
"""
from __future__ import annotations

import logging
import os
import urllib.parse
from typing import Any

logger = logging.getLogger("app.redis_client")

# ─── Singleton connection state ───────────────────────────────────────────────
_client: Any = None          # redis.Redis instance or None
_init_done: bool = False     # prevent repeated reconnection attempts


def _build_client() -> Any | None:
    """
    Parse REDIS_URL from the environment and build a Redis client
    with an SSL-capable connection pool.  Returns None on any failure.
    """
    raw_url = os.environ.get("REDIS_URL", "").strip()
    if not raw_url:
        try:
            from app.core.config import get_settings

            raw_url = (get_settings().redis_url or "").strip()
        except Exception:
            raw_url = ""
    if not raw_url:
        logger.debug("REDIS_URL not set — Redis cache disabled")
        return None

    try:
        import redis as _redis_pkg
        from redis.connection import SSLConnection, Connection

        parsed = urllib.parse.urlparse(raw_url)
        use_ssl = parsed.scheme in ("rediss", "redis+ssl")

        # Build connection pool kwargs
        pool_kwargs: dict[str, Any] = {
            "host": parsed.hostname or "localhost",
            "port": parsed.port or (6380 if use_ssl else 6379),
            "db": int((parsed.path or "/0").lstrip("/") or 0),
            "decode_responses": True,
            "socket_connect_timeout": 3,
            "socket_timeout": 3,
            "max_connections": 10,
        }

        # Password — extracted from URL only, never from code
        if parsed.password:
            pool_kwargs["password"] = parsed.password

        # Username (Redis ACL; 'default' is the default Redis user)
        if parsed.username and parsed.username != "default":
            pool_kwargs["username"] = parsed.username

        if use_ssl:
            pool_kwargs["connection_class"] = SSLConnection
            pool_kwargs["ssl_cert_reqs"] = "none"   # Redis Cloud uses valid certs;
                                                     # "none" avoids hostname mismatch issues
                                                     # on some managed Redis providers.
        else:
            pool_kwargs["connection_class"] = Connection

        pool = _redis_pkg.ConnectionPool(**pool_kwargs)
        r = _redis_pkg.Redis(connection_pool=pool)

        # Validate the connection is alive
        r.ping()
        logger.info(
            "Redis connected (%s:%s, ssl=%s)",
            pool_kwargs["host"],
            pool_kwargs["port"],
            use_ssl,
        )
        return r

    except Exception as exc:
        logger.warning("Redis unavailable — running without cache: %s", exc)
        return None


def _get_client() -> Any | None:
    """Return the Redis client, initialising it once per process."""
    global _client, _init_done
    if _init_done:
        return _client
    _client = _build_client()
    _init_done = True
    return _client


def get_shared_redis() -> Any | None:
    """Use the same TLS-aware pool as the rest of the app (M3U dedup, sync state, list cache)."""
    return _get_client()


# ─── Safe public wrappers ─────────────────────────────────────────────────────
# All functions catch every exception and return a safe default.
# They NEVER raise, NEVER crash the caller.

def safe_get(key: str) -> str | None:
    """Return the string value for ``key``, or None if missing / Redis down."""
    try:
        r = _get_client()
        if r is None:
            return None
        value = r.get(key)
        if value is not None:
            logger.debug("Redis cache HIT  key=%s", key)
        return value  # type: ignore[return-value]
    except Exception as exc:
        logger.debug("Redis safe_get error (key=%s): %s", key, exc)
        return None


def safe_set(key: str, value: str, ttl: int = 300) -> bool:
    """
    Store ``value`` under ``key`` with an expiry of ``ttl`` seconds.
    Returns True on success, False otherwise.
    """
    try:
        r = _get_client()
        if r is None:
            return False
        r.setex(key, ttl, value)
        logger.debug("Redis cache SET  key=%s  ttl=%ss", key, ttl)
        return True
    except Exception as exc:
        logger.debug("Redis safe_set error (key=%s): %s", key, exc)
        return False


def safe_exists(key: str) -> bool:
    """Return True if ``key`` exists in Redis, False if absent or Redis down."""
    try:
        r = _get_client()
        if r is None:
            return False
        exists = bool(r.exists(key))
        if exists:
            logger.debug("Redis dedup HIT  key=%s", key)
        return exists
    except Exception as exc:
        logger.debug("Redis safe_exists error (key=%s): %s", key, exc)
        return False


def safe_delete(key: str) -> bool:
    """Delete ``key`` from Redis.  Returns True on success, False otherwise."""
    try:
        r = _get_client()
        if r is None:
            return False
        r.delete(key)
        return True
    except Exception as exc:
        logger.debug("Redis safe_delete error (key=%s): %s", key, exc)
        return False
