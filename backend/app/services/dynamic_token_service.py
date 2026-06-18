"""
Dynamic Token Service — fetches live authentication headers from GitHub JSON repos.

Sources:
  T-Sports : byte-capsule/TSports-m3u8-Grabber / TSports_m3u8_headers.Json
  Toffee   : Gtajisan/Toffee-Auto-Update-Playlist / toffee_channel_data.json

Results cached in Redis (T-Sports: 12h TTL, Toffee: 1h TTL).
Falls back to None/empty on any failure — callers degrade gracefully.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx

logger = logging.getLogger("app.dynamic_token")

_FETCH_RETRY_DELAYS = (2.0, 4.0)  # waits before attempt 2 and 3 (total: up to 3 tries)

_TSPORTS_JSON_URL = (
    "https://raw.githubusercontent.com/byte-capsule/TSports-m3u8-Grabber"
    "/main/TSports_m3u8_headers.Json"
)
_TOFFEE_JSON_URL = (
    "https://raw.githubusercontent.com/Gtajisan/Toffee-Auto-Update-Playlist"
    "/main/toffee_channel_data.json"
)

_FETCH_TIMEOUT = 10.0

_TSPORTS_REDIS_KEY = "gstv:dts:tsports_v1"
_TOFFEE_REDIS_KEY = "gstv:dts:toffee_v1"
_TSPORTS_TTL = 43200   # 12 hours — T-Sports tokens last ~12h
_TOFFEE_TTL = 3600     # 1 hour  — Toffee tokens last 30 min–5h


# ──────────────────────── HTTP helper ─────────────────────────────────────────

def _fetch_with_retry(url: str) -> httpx.Response:
    """GET url with up to 3 total attempts and exponential backoff (2 s, 4 s)."""
    last_exc: Exception | None = None
    for attempt, delay in enumerate((_FETCH_RETRY_DELAYS[0] * 0, *_FETCH_RETRY_DELAYS)):
        if delay:
            time.sleep(delay)
        try:
            return httpx.get(url, timeout=_FETCH_TIMEOUT, follow_redirects=True)
        except Exception as exc:
            last_exc = exc
            logger.debug("Token fetch attempt %d failed for %s: %s", attempt + 1, url[:60], exc)
    raise last_exc  # type: ignore[misc]


# ──────────────────────── Redis helpers ───────────────────────────────────────

def _redis_get(key: str) -> dict | list | None:
    try:
        from app.core.redis_client import safe_get
        raw = safe_get(key)
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    return None


def _redis_set(key: str, data: Any, ttl: int) -> None:
    try:
        from app.core.redis_client import safe_set
        safe_set(key, json.dumps(data, ensure_ascii=False), ttl=ttl)
    except Exception:
        pass


def _redis_delete(key: str) -> None:
    try:
        from app.core.redis_client import safe_delete
        safe_delete(key)
    except Exception:
        pass


# ──────────────────────── JSON parsers ────────────────────────────────────────

def _parse_headers(data: Any) -> dict[str, str]:
    """Extract HTTP headers from various JSON formats."""
    headers: dict[str, str] = {}
    if not isinstance(data, dict):
        return headers

    # Common nested header fields
    for field in ("headers", "header", "Headers", "Header"):
        h = data.get(field)
        if isinstance(h, dict):
            headers.update({str(k): str(v) for k, v in h.items()})
            break

    # Standalone cookie fields (fallback if not inside "headers")
    if not any(k.lower() == "cookie" for k in headers):
        for field in ("cookie", "Cookie", "cookies", "edge_cache_cookie", "Edge-Cache-Cookie"):
            c = data.get(field)
            if c and isinstance(c, str):
                headers["Cookie"] = c
                break

    # Standalone User-Agent fields
    if not any(k.lower() == "user-agent" for k in headers):
        for field in ("user_agent", "user-agent", "User-Agent", "useragent"):
            ua = data.get(field)
            if ua and isinstance(ua, str):
                headers["User-Agent"] = ua
                break

    return headers


def _parse_stream_url(data: Any) -> str | None:
    """Extract the primary .m3u8 URL from various JSON formats."""
    if not isinstance(data, dict):
        return None
    for field in ("m3u8_url", "stream_url", "url", "m3u8", "hls_url", "link", "Url", "URL"):
        url = data.get(field)
        if url and isinstance(url, str) and url.startswith("http"):
            return url
    return None


# ──────────────────────── T-Sports ────────────────────────────────────────────

def fetch_tsports_token(*, force: bool = False) -> dict | None:
    """
    Return T-Sports dynamic stream info from GitHub JSON.

    Returns dict with keys 'm3u8_url' (str|None) and 'headers' (dict),
    or None if the fetch/parse fails entirely.

    Results are cached in Redis for ``_TSPORTS_TTL`` seconds.
    Pass ``force=True`` to bypass cache and force a re-fetch.
    """
    if not force:
        cached = _redis_get(_TSPORTS_REDIS_KEY)
        if cached and isinstance(cached, dict):
            logger.debug("T-Sports token cache HIT")
            return cached

    try:
        resp = _fetch_with_retry(_TSPORTS_JSON_URL)
        if resp.status_code != 200:
            logger.warning("T-Sports JSON fetch: HTTP %d", resp.status_code)
            return None

        data = resp.json()
        headers = _parse_headers(data)
        stream_url = _parse_stream_url(data)

        # If data is a list, take the first item
        if not headers and not stream_url and isinstance(data, list) and data:
            first = data[0]
            headers = _parse_headers(first)
            stream_url = _parse_stream_url(first)

        result: dict = {"m3u8_url": stream_url, "headers": headers}
        _redis_set(_TSPORTS_REDIS_KEY, result, _TSPORTS_TTL)
        logger.info(
            "T-Sports token refreshed — url=%s headers_count=%d",
            bool(stream_url),
            len(headers),
        )
        return result

    except Exception as exc:
        logger.warning("T-Sports token fetch failed: %s", exc)
        return None


# ──────────────────────── Toffee ──────────────────────────────────────────────

def fetch_toffee_tokens(*, force: bool = False) -> list[dict] | None:
    """
    Return a list of Toffee channel token dicts from GitHub JSON.

    Each item has keys 'name' (str), 'm3u8_url' (str|None), 'headers' (dict).
    Returns None if the fetch/parse fails entirely.
    """
    if not force:
        cached = _redis_get(_TOFFEE_REDIS_KEY)
        if cached and isinstance(cached, list):
            logger.debug("Toffee token cache HIT (%d channels)", len(cached))
            return cached

    try:
        resp = _fetch_with_retry(_TOFFEE_JSON_URL)
        if resp.status_code != 200:
            logger.warning("Toffee JSON fetch: HTTP %d", resp.status_code)
            return None

        data = resp.json()
        channels: list[dict] = []

        def _process_item(item: Any) -> None:
            if not isinstance(item, dict):
                return
            name = str(item.get("name", item.get("Name", "")))
            url = _parse_stream_url(item)
            hdrs = _parse_headers(item)
            if url or hdrs:
                channels.append({"name": name, "m3u8_url": url, "headers": hdrs})

        if isinstance(data, list):
            for item in data:
                _process_item(item)
        elif isinstance(data, dict):
            # Try common wrapper fields
            items_raw = data.get("channels") or data.get("data") or data.get("streams") or []
            if isinstance(items_raw, list):
                for item in items_raw:
                    _process_item(item)
            else:
                _process_item(data)  # Single channel format

        if channels:
            _redis_set(_TOFFEE_REDIS_KEY, channels, _TOFFEE_TTL)
            logger.info("Toffee tokens refreshed — %d channels", len(channels))
            return channels

        logger.warning("Toffee JSON parsed but no channels found (format unknown)")
        return None

    except Exception as exc:
        logger.warning("Toffee token fetch failed: %s", exc)
        return None


def get_toffee_channel_headers(
    channel_name: str,
    toffee_cache: list[dict] | None = None,
) -> dict[str, str]:
    """
    Return headers for a Toffee channel by fuzzy name match.
    Pass ``toffee_cache`` to avoid a second Redis/HTTP round-trip.
    """
    channels = toffee_cache if toffee_cache is not None else fetch_toffee_tokens()
    if not channels:
        return {}

    name_lower = channel_name.lower()
    for ch in channels:
        cname = ch.get("name", "").lower()
        if cname and (name_lower in cname or cname in name_lower):
            return ch.get("headers", {})
    return {}


# ──────────────────────── Admin helper ────────────────────────────────────────

def refresh_all_tokens() -> dict[str, str]:
    """Force-refresh all dynamic tokens, bypassing the Redis cache."""
    _redis_delete(_TSPORTS_REDIS_KEY)
    _redis_delete(_TOFFEE_REDIS_KEY)

    tsports = fetch_tsports_token(force=True)
    toffee = fetch_toffee_tokens(force=True)

    return {
        "tsports": "ok" if tsports else "failed",
        "toffee": f"ok ({len(toffee)} channels)" if toffee else "failed",
    }
