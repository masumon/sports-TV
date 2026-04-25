"""
Stream Validation Engine  (Phase 6)

Validates IPTV stream URLs using a thread pool.
Uses httpx with HEAD → Range-GET fallback strategy.
Designed to be called from sync (APScheduler) context.
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx

logger = logging.getLogger("app.validator")

_STREAM_TIMEOUT = 5.0   # seconds per URL
_MAX_WORKERS = 20       # max concurrent validations


def _validate_one(url: str) -> bool:
    """
    Validate a single stream URL.

    Strategy:
    1. HTTP HEAD request  (fastest – no body transfer)
    2. If HEAD returns 405 or fails, fallback to byte-range GET
    3. Accept 200, 206 (partial), or 416 (range not satisfiable but URL alive)
    """
    try:
        with httpx.Client(
            timeout=_STREAM_TIMEOUT,
            follow_redirects=True,
            verify=False,   # Many IPTV servers use self-signed certs
        ) as client:
            # ── 1. HEAD ─────────────────────────────────────────────────────
            try:
                resp = client.head(url)
                if resp.status_code in (200, 206):
                    return True
                if resp.status_code == 405:
                    # Method not allowed — fall through to GET
                    pass
                elif resp.status_code >= 400:
                    return False
            except (httpx.TimeoutException, httpx.ConnectError):
                return False
            except Exception:
                pass  # fall through to GET

            # ── 2. Byte-range GET (minimal bandwidth) ───────────────────────
            try:
                resp = client.get(url, headers={"Range": "bytes=0-0"})
                return resp.status_code in (200, 206, 416)
            except Exception:
                return False
    except Exception:
        return False


def validate_stream_urls(
    urls: list[str],
    max_workers: int = _MAX_WORKERS,
) -> dict[str, bool]:
    """
    Validate multiple stream URLs concurrently.

    Returns a {url: is_alive} mapping.
    Never raises — failed futures are recorded as False.
    """
    if not urls:
        return {}

    results: dict[str, bool] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        future_to_url = {pool.submit(_validate_one, url): url for url in urls}
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                results[url] = future.result()
            except Exception:
                results[url] = False

    alive = sum(1 for v in results.values() if v)
    logger.info(
        "Stream validation: %d/%d alive  (of %d checked)",
        alive,
        len(urls),
        len(urls),
    )
    return results
