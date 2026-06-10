"""
Fast HEAD/Range GET probes for admin stream health UI.
Results cached in Redis (10m) to avoid hammering origins on Render free tier.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import httpx
from fastapi import HTTPException

from app.core.redis_client import safe_get, safe_set
from app.schemas.admin import StreamProbeItemResult

logger = logging.getLogger("app.stream_probe")

PROBE_CACHE_PREFIX = "stream_probe:v1:"
PROBE_CACHE_TTL_SECONDS = 600
PROBE_CONCURRENCY = 4

_DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def _cache_key(url: str) -> str:
    return PROBE_CACHE_PREFIX + hashlib.sha256(url.strip().encode("utf-8")).hexdigest()


def _classify(status_code: int | None) -> str:
    """Classify stream health status.
    
    - 200, 206: Alive (content delivered)
    - 401: Auth required (might work with correct headers)
    - 403: Ambiguous - could be geo-blocked OR permission denied; assume temporary
    - 451: Legally blocked (country-specific censorship; clearly geo-blocked)
    - 404, 410: Dead (not found / gone)
    - None/timeout: Unreachable (dead)
    """
    if status_code in (200, 206):
        return "alive"
    if status_code == 451:
        return "geo_blocked"  # Clear legal block
    if status_code in (401, 403):
        return "geo_blocked"  # Treat as temp geo-block; system will retry or fallback
    return "dead"


async def _probe_one(
    client: httpx.AsyncClient,
    url: str,
    validate,
) -> StreamProbeItemResult:
    raw = url.strip()
    ck = _cache_key(raw)
    hit = safe_get(ck)
    if hit:
        try:
            d = json.loads(hit)
            return StreamProbeItemResult(
                url=raw,
                status=str(d.get("status", "dead")),
                http_status=d.get("http_status"),
                cached=True,
            )
        except Exception:
            pass

    try:
        target = validate(raw)
    except HTTPException:
        body = {"status": "dead", "http_status": None}
        safe_set(ck, json.dumps(body), PROBE_CACHE_TTL_SECONDS)
        return StreamProbeItemResult(url=raw, status="dead", http_status=None, cached=False)

    timeout = httpx.Timeout(connect=5.0, read=8.0, write=5.0, pool=5.0)
    range_headers = {
        "Range": "bytes=0-0",
        "User-Agent": _DEFAULT_UA,
        "Accept": "*/*",
    }
    status_code: int | None = None
    try:
        path = target.split("?", 1)[0].lower()
        is_hls_playlist = path.endswith(".m3u8") or path.endswith(".m3u")
        if is_hls_playlist:
            getr = await client.get(
                target, headers=range_headers, follow_redirects=True, timeout=timeout
            )
            status_code = getr.status_code
        else:
            head = await client.head(target, follow_redirects=True, timeout=timeout)
            status_code = head.status_code
            if status_code in (405, 501):
                getr = await client.get(
                    target, headers=range_headers, follow_redirects=True, timeout=timeout
                )
                status_code = getr.status_code
    except httpx.TimeoutException:
        logger.debug("probe timeout: %s", raw[:80])
        body = {"status": "dead", "http_status": None}
        safe_set(ck, json.dumps(body), PROBE_CACHE_TTL_SECONDS)
        return StreamProbeItemResult(url=raw, status="dead", http_status=None, cached=False)
    except Exception as exc:
        logger.debug("probe error: %s — %s", raw[:80], exc)
        body = {"status": "dead", "http_status": None}
        safe_set(ck, json.dumps(body), PROBE_CACHE_TTL_SECONDS)
        return StreamProbeItemResult(url=raw, status="dead", http_status=None, cached=False)

    st = _classify(status_code)
    payload = {"status": st, "http_status": status_code}
    safe_set(ck, json.dumps(payload), PROBE_CACHE_TTL_SECONDS)
    return StreamProbeItemResult(
        url=raw, status=st, http_status=status_code, cached=False
    )


async def run_probe_batch(urls: list[str], validate) -> list[StreamProbeItemResult]:
    """Run probes with bounded concurrency; ``validate`` is ``_validate_stream_url`` from proxy."""
    if not urls:
        return []

    sem = asyncio.Semaphore(PROBE_CONCURRENCY)

    async with httpx.AsyncClient(
        verify=False,
        trust_env=False,
        limits=httpx.Limits(max_keepalive_connections=8, max_connections=12),
    ) as client:

        async def gated(u: str) -> StreamProbeItemResult:
            async with sem:
                return await _probe_one(client, u, validate)

        return list(await asyncio.gather(*[gated(u) for u in urls]))
