"""
Stream Validation Engine  (Phase 6 — Upgraded)

Validates IPTV stream URLs concurrently.

Sync path  (APScheduler / admin routes):
  validate_stream_urls()   — ThreadPoolExecutor, up to MAX_SYNC_WORKERS
  Backward-compatible with all existing callers.

Async path  (new API endpoints):
  async_validate_stream_urls()  — aiohttp, up to MAX_ASYNC_WORKERS

Strategy per URL:
  1. HLS .m3u8 path → Range-GET first (many CDNs return 404 to HEAD)
  2. Other streams   → HEAD, then byte-range GET if HEAD returns 405 / fails
  3. Accept: 200, 206, 416 (range not satisfiable but server is alive)
  4. Treat 401, 403, 407, 451 as dead (geo-blocked from server region — stream won't play)
  5. Reject: 404, 410, timeout, connection error
"""
from __future__ import annotations

import asyncio
import logging
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx

logger = logging.getLogger("app.validator")

_STREAM_TIMEOUT = 5.0       # seconds — per URL (sync path)
_ASYNC_TIMEOUT = 5.0        # seconds — per URL (async path)
MAX_SYNC_WORKERS = 30       # safe cap for Render free-tier RAM
MAX_ASYNC_WORKERS = 50      # aiohttp semaphore slots
_ALIVE_CODES = frozenset({200, 206, 416})
_GEO_BLOCKED_CODES = frozenset({401, 403, 407, 451})  # URL exists but blocked from our region — treated as dead
_DEAD_CODES = frozenset({404, 410})


# ──────────────────────────── helpers ─────────────────────────────────────

def _url_path_suggests_hls(url: str) -> bool:
    try:
        path = urllib.parse.urlparse(url).path.lower()
        return path.endswith(".m3u8")
    except Exception:
        return False


# ──────────────────────────── sync validator ──────────────────────────────

def _validate_one(url: str) -> bool:
    """
    Validate a single stream URL (synchronous).

    HLS (.m3u8) — byte-range GET first (avoids false-negative from CDN HEAD 404).
    Other        — HEAD, fallback byte-range GET on 405 / exception.
    """
    hls = _url_path_suggests_hls(url)
    try:
        with httpx.Client(
            timeout=_STREAM_TIMEOUT,
            follow_redirects=True,
            verify=False,
            trust_env=False,
        ) as client:
            if hls:
                try:
                    r = client.get(url, headers={"Range": "bytes=0-0"})
                    if r.status_code in _ALIVE_CODES:
                        return True
                    if r.status_code in _GEO_BLOCKED_CODES:
                        return False
                    if r.status_code in _DEAD_CODES:
                        return False
                except (httpx.TimeoutException, httpx.ConnectError):
                    return False
                except Exception:
                    return False
                return False

            # Non-HLS: HEAD first
            try:
                r = client.head(url)
                if r.status_code in _ALIVE_CODES:
                    return True
                if r.status_code in _GEO_BLOCKED_CODES:
                    return False
                if r.status_code in _DEAD_CODES:
                    return False
                if r.status_code != 405:
                    return False
                # 405 Method Not Allowed → fall through to GET
            except (httpx.TimeoutException, httpx.ConnectError):
                return False
            except Exception:
                pass

            # Byte-range GET fallback
            try:
                r = client.get(url, headers={"Range": "bytes=0-0"})
                return r.status_code in _ALIVE_CODES
            except Exception:
                return False
    except Exception:
        return False


def validate_stream_urls(
    urls: list[str],
    max_workers: int = MAX_SYNC_WORKERS,
) -> dict[str, bool]:
    """
    Validate multiple stream URLs concurrently (synchronous).

    Returns {url: is_alive}. Never raises — failed futures → False.
    Default worker cap is `MAX_SYNC_WORKERS` (30) for free-tier safety.
    """
    if not urls:
        return {}

    workers = min(max(1, max_workers), MAX_SYNC_WORKERS)
    results: dict[str, bool] = {}

    with ThreadPoolExecutor(max_workers=workers) as pool:
        future_to_url = {pool.submit(_validate_one, url): url for url in urls}
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                results[url] = future.result()
            except Exception:
                results[url] = False

    alive = sum(1 for v in results.values() if v)
    logger.info(
        "Stream validation (sync): %d/%d alive out of %d checked",
        alive,
        len(results),
        len(urls),
    )
    return results


# ──────────────────────────── async validator ─────────────────────────────

async def _async_validate_one(
    url: str,
    session: "aiohttp.ClientSession",  # type: ignore[name-defined]
    sem: asyncio.Semaphore,
) -> tuple[str, bool]:
    """
    Async validation of one URL using aiohttp.
    Respects the semaphore for concurrency control.
    """
    try:
        import aiohttp  # noqa: F401 — optional dependency
    except ImportError:
        # Fall back to sync path if aiohttp is not installed
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _validate_one, url)
        return url, result

    import aiohttp

    hls = _url_path_suggests_hls(url)
    timeout = aiohttp.ClientTimeout(total=_ASYNC_TIMEOUT, connect=3.0)

    async with sem:
        try:
            if hls:
                async with session.get(
                    url,
                    headers={"Range": "bytes=0-0"},
                    timeout=timeout,
                    allow_redirects=True,
                    ssl=False,
                ) as resp:
                    if resp.status in _ALIVE_CODES:
                        return url, True
                    if resp.status in _GEO_BLOCKED_CODES:
                        return url, False
                    return url, False
            else:
                try:
                    async with session.head(
                        url, timeout=timeout, allow_redirects=True, ssl=False
                    ) as resp:
                        if resp.status in _ALIVE_CODES:
                            return url, True
                        if resp.status in _GEO_BLOCKED_CODES:
                            return url, False
                        if resp.status in _DEAD_CODES:
                            return url, False
                        if resp.status != 405:
                            return url, False
                except Exception:
                    pass

                async with session.get(
                    url,
                    headers={"Range": "bytes=0-0"},
                    timeout=timeout,
                    allow_redirects=True,
                    ssl=False,
                ) as resp:
                    if resp.status in _ALIVE_CODES:
                        return url, True
                    if resp.status in _GEO_BLOCKED_CODES:
                        return url, False
                    return url, False

        except asyncio.TimeoutError:
            return url, False
        except Exception:
            return url, False


async def async_validate_stream_urls(
    urls: list[str],
    max_workers: int = MAX_ASYNC_WORKERS,
) -> dict[str, bool]:
    """
    Validate multiple stream URLs concurrently using aiohttp.

    Falls back to the sync ThreadPoolExecutor path if aiohttp is unavailable.
    Default semaphore allows up to `MAX_ASYNC_WORKERS` (50) concurrent requests.

    Returns {url: is_alive}. Never raises.
    """
    if not urls:
        return {}

    try:
        import aiohttp
    except ImportError:
        logger.warning("aiohttp not available — falling back to sync validation")
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, validate_stream_urls, urls, MAX_SYNC_WORKERS
        )

    import aiohttp

    workers = min(max(1, max_workers), MAX_ASYNC_WORKERS)
    sem = asyncio.Semaphore(workers)
    results: dict[str, bool] = {}

    connector = aiohttp.TCPConnector(
        ssl=False,
        limit=workers,
        ttl_dns_cache=120,
        force_close=False,
        enable_cleanup_closed=True,
    )

    async with aiohttp.ClientSession(
        connector=connector,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            ),
            "Accept": "*/*",
        },
    ) as session:
        tasks = [_async_validate_one(url, session, sem) for url in urls]
        for coro in asyncio.as_completed(tasks):
            try:
                url, alive = await coro
                results[url] = alive
            except Exception as exc:
                logger.debug("async_validate_one error: %s", exc)

    alive = sum(1 for v in results.values() if v)
    logger.info(
        "Stream validation (async): %d/%d alive out of %d checked",
        alive,
        len(results),
        len(urls),
    )
    return results


def validate_stream_urls_batch(
    urls: list[str],
    batch_size: int = 100,
    max_workers: int = MAX_SYNC_WORKERS,
) -> dict[str, bool]:
    """
    Validate a large list in batches to avoid overwhelming the event loop.
    Uses the sync path (safe for scheduler + threadpool callers).
    """
    if not urls:
        return {}
    results: dict[str, bool] = {}
    for i in range(0, len(urls), batch_size):
        batch = urls[i : i + batch_size]
        results.update(validate_stream_urls(batch, max_workers=max_workers))
    return results
