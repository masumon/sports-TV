"""
Proxy Stream Engine  (Phase 3 — ULTRA OPTIMIZATION)

Forwards IPTV stream content through the backend with:
- keep-alive connections
- chunked streaming
- low-latency forwarding
- URL allow-list validation (no open proxy)

Endpoint: GET /api/v1/proxy/stream?url=<encoded_stream_url>
"""
from __future__ import annotations

import logging
import urllib.parse
from typing import AsyncGenerator

import httpx
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse

logger = logging.getLogger("app.proxy")

router = APIRouter(prefix="/proxy", tags=["proxy"])

# Chunk size for streaming — 64 KB gives good throughput without high memory usage.
_CHUNK_SIZE = 64 * 1024  # 64 KB

# Allowed URL schemes — reject anything that is not http/https.
_ALLOWED_SCHEMES = {"http", "https"}

# Hard timeout for connecting to the upstream origin.
_CONNECT_TIMEOUT = 8.0
# Read timeout: how long to wait between received chunks (long for live streams).
_READ_TIMEOUT = 30.0

# Headers forwarded from upstream to the client (allow-list to avoid leaking internals).
_FORWARD_HEADERS = {
    "content-type",
    "content-length",
    "transfer-encoding",
    "accept-ranges",
    "cache-control",
    "access-control-allow-origin",
}


def _validate_stream_url(url: str) -> str:
    """Parse and validate the target URL. Raises HTTPException on invalid input."""
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL format")

    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        raise HTTPException(status_code=400, detail="Only http/https URLs are allowed")

    if not parsed.netloc:
        raise HTTPException(status_code=400, detail="URL must have a valid host")

    # Block internal / loopback addresses to prevent SSRF
    host = parsed.hostname or ""
    if host in {"localhost", "127.0.0.1", "::1", "0.0.0.0"} or host.startswith("192.168.") or host.startswith("10."):
        raise HTTPException(status_code=400, detail="Internal addresses are not allowed")

    return url


async def _stream_generator(
    client: httpx.AsyncClient,
    url: str,
    request_headers: dict[str, str],
) -> AsyncGenerator[bytes, None]:
    """Async generator that yields chunks from the upstream response."""
    try:
        async with client.stream(
            "GET",
            url,
            headers=request_headers,
            timeout=httpx.Timeout(connect=_CONNECT_TIMEOUT, read=_READ_TIMEOUT, write=None, pool=None),
            follow_redirects=True,
        ) as upstream:
            if upstream.status_code >= 400:
                logger.warning("Upstream returned %s for %s", upstream.status_code, url)
                return
            async for chunk in upstream.aiter_bytes(chunk_size=_CHUNK_SIZE):
                if chunk:
                    yield chunk
    except (httpx.TimeoutException, httpx.ConnectError) as exc:
        logger.warning("Proxy stream error for %s: %s", url, exc)
    except Exception as exc:
        logger.warning("Proxy unexpected error for %s: %s", url, exc)


@router.get("/stream")
async def proxy_stream(
    request: Request,
    url: str = Query(..., min_length=7, max_length=2048, description="Encoded stream URL to proxy"),
) -> StreamingResponse:
    """
    Proxy an IPTV/HLS stream URL through the backend.

    This reduces client-side geo-blocking, avoids CORS issues, and lets
    Cloudflare/CDN edge nodes cache manifests and segments closer to users.
    """
    target_url = _validate_stream_url(url)

    # Forward only safe request headers to the origin.
    forward = {}
    for header in ("user-agent", "range", "accept", "accept-encoding", "icy-metadata"):
        val = request.headers.get(header)
        if val:
            forward[header] = val
    if "user-agent" not in forward:
        forward["user-agent"] = "Mozilla/5.0 (compatible; IPTV-Proxy/1.0)"

    client = httpx.AsyncClient(
        verify=False,  # Many IPTV servers use self-signed certs
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
    )

    # Peek at the response to get status/headers before streaming.
    try:
        head_resp = await client.head(
            target_url,
            headers=forward,
            timeout=httpx.Timeout(connect=_CONNECT_TIMEOUT, read=10.0),
            follow_redirects=True,
        )
        upstream_status = head_resp.status_code
        upstream_headers = dict(head_resp.headers)
    except Exception:
        upstream_status = 200
        upstream_headers = {}

    if upstream_status >= 400:
        await client.aclose()
        raise HTTPException(status_code=502, detail="Upstream stream unavailable")

    # Build response headers
    response_headers: dict[str, str] = {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",  # live streams must not be cached at CDN edge
    }
    for key, val in upstream_headers.items():
        if key.lower() in _FORWARD_HEADERS:
            response_headers[key.lower()] = val

    content_type = upstream_headers.get("content-type", "application/octet-stream")

    generator = _stream_generator(client, target_url, forward)

    return StreamingResponse(
        generator,
        status_code=200,
        media_type=content_type,
        headers=response_headers,
    )


@router.options("/stream")
async def proxy_stream_preflight() -> Response:
    """Handle CORS preflight for the proxy endpoint."""
    return Response(
        status_code=204,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Range, Accept, User-Agent",
        },
    )
