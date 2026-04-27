"""
Stream Validation Engine  (Phase 6)

Validates IPTV stream URLs using a thread pool.
Uses httpx with HEAD → Range-GET fallback strategy.
HLS master playlists (``.m3u8``) often return 404 to HEAD while GET works — those use Range-GET first.
Designed to be called from sync (APScheduler) context.
"""
from __future__ import annotations

import logging
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx

logger = logging.getLogger("app.validator")

_STREAM_TIMEOUT = 5.0   # seconds per URL
_MAX_WORKERS = 20       # max concurrent validations


def _url_path_suggests_hls_manifest(url: str) -> bool:
    try:
        path = urllib.parse.urlparse(url).path.lower()
        return path.endswith(".m3u8")
    except Exception:
        return False


def _validate_one(url: str) -> bool:
    """
    Validate a single stream URL.

    Strategy:
    1. HLS master (``.m3u8`` path): byte-range GET first (many CDNs 404/405 on HEAD).
    2. Otherwise: HTTP HEAD, then byte-range GET if needed
    3. Accept 200, 206 (partial), or 416 (range not satisfiable but URL alive)
    4. Treat 401, 403, 407, 451 as "alive but geo-blocked/auth-restricted" —
       these channels exist and should remain active in the DB so users can
       attempt them via proxy or alternate streams.
    """
    hls = _url_path_suggests_hls_manifest(url)
    try:
        with httpx.Client(
            timeout=_STREAM_TIMEOUT,
            follow_redirects=True,
            verify=False,   # Many IPTV servers use self-signed certs
            trust_env=False,  # Do not route checks through HTTP(S)_PROXY
        ) as client:
            if hls:
                # ── HLS: avoid false negatives from HEAD-only (404 on HEAD, 200 on GET) ─
                try:
                    resp = client.get(url, headers={"Range": "bytes=0-0"})
                    if resp.status_code in (200, 206):
                        return True
                    if resp.status_code in (401, 403, 407, 451):
                        return True
                    if resp.status_code == 416:
                        return True
                    if resp.status_code in (404, 410):
                        return False
                except (httpx.TimeoutException, httpx.ConnectError):
                    return False
                except Exception:
                    return False
                return False

            # ── 1. HEAD (non-HLS) ──────────────────────────────────────────
            try:
                resp = client.head(url)
                if resp.status_code in (200, 206):
                    return True
                # Geo-blocked / auth-required / legal restriction — URL exists
                if resp.status_code in (401, 403, 407, 451):
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
                return resp.status_code in (200, 206, 401, 403, 407, 416, 451)
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
