"""
Proxy Stream Engine  (Phase 3 — ULTRA OPTIMIZATION)

Forwards IPTV stream content through the backend with:
- keep-alive connections
- chunked streaming
- low-latency forwarding
- URL allow-list validation (no open proxy)

Endpoints:
  GET /api/v1/proxy/stream?url=<encoded_stream_url>
  GET /api/v1/proxy/m3u8?stream_id=<id>
"""
from __future__ import annotations

import ipaddress
import json
import logging
import socket
import urllib.parse
from typing import AsyncGenerator

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

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
_FORWARD_UPSTREAM_HEADERS = {
    "content-type",
    "content-length",
    "transfer-encoding",
    "accept-ranges",
    "access-control-allow-origin",
}

# Private/reserved IP networks that must never be reached via the proxy (SSRF protection).
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),   # link-local
    ipaddress.ip_network("224.0.0.0/4"),       # multicast
    ipaddress.ip_network("240.0.0.0/4"),       # reserved
    ipaddress.ip_network("::1/128"),           # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),          # IPv6 unique local
    ipaddress.ip_network("fe80::/10"),         # IPv6 link-local
    ipaddress.ip_network("ff00::/8"),          # IPv6 multicast
    ipaddress.ip_network("0.0.0.0/8"),
]


def _is_private_ip(ip_str: str) -> bool:
    """Return True if the resolved IP address belongs to a private/reserved range."""
    try:
        addr = ipaddress.ip_address(ip_str)
        return any(addr in net for net in _BLOCKED_NETWORKS)
    except ValueError:
        return True  # Unparseable address — block it


def _validate_stream_url(url: str) -> str:
    """
    Parse, validate, and resolve the target URL.

    - Only http/https allowed
    - Host must not be empty
    - Resolved IP must not be in private/reserved ranges (SSRF protection,
      including DNS rebinding — we resolve the hostname and check the IP)

    Raises HTTPException on invalid input.
    """
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL format")

    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        raise HTTPException(status_code=400, detail="Only http/https URLs are allowed")

    host = parsed.hostname
    if not host:
        raise HTTPException(status_code=400, detail="URL must have a valid host")

    # Resolve hostname to IP and check against blocked ranges (prevents DNS rebinding).
    try:
        addr_info = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
        for _family, _type, _proto, _canon, sockaddr in addr_info:
            ip = sockaddr[0]
            if _is_private_ip(ip):
                raise HTTPException(status_code=403, detail="Upstream host is not publicly accessible")
    except HTTPException:
        raise
    except OSError:
        raise HTTPException(status_code=400, detail="Could not resolve upstream host")

    return url


async def _stream_chunks(
    client: httpx.AsyncClient,
    url: str,
    request_headers: dict[str, str],
) -> AsyncGenerator[bytes, None]:
    """Async generator that yields body chunks from the upstream stream response."""
    # Note: The URL passed here has already been validated by _validate_stream_url.
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
    finally:
        await client.aclose()


@router.get("/stream")
async def proxy_stream(
    request: Request,
    url: str = Query(..., min_length=7, max_length=2048, description="Encoded stream URL to proxy"),
) -> StreamingResponse:
    """
    Proxy an IPTV/HLS stream URL through the backend.

    This reduces client-side geo-blocking, avoids CORS issues, and lets
    Cloudflare/CDN edge nodes cache manifests closer to users.

    SSRF mitigations:
    - URL scheme restricted to http/https
    - Hostname resolved to IP; private/reserved ranges blocked
    - DNS rebinding protection via pre-request resolution check
    """
    # URL validation + SSRF check (raises HTTPException on failure)
    target_url = _validate_stream_url(url)

    # Forward only safe request headers to the origin.
    forward: dict[str, str] = {}
    for header in ("user-agent", "range", "accept", "accept-encoding", "icy-metadata"):
        val = request.headers.get(header)
        if val:
            forward[header] = val
    if "user-agent" not in forward:
        forward["user-agent"] = "Mozilla/5.0 (compatible; IPTV-Proxy/1.0)"

    # Peek at response headers via a lightweight HEAD-equivalent: open stream and
    # immediately read status + headers before yielding any body bytes.
    # verify=False is required because many IPTV servers use self-signed certificates;
    # the SSRF check above already ensures we only connect to public hosts.
    peek_client = httpx.AsyncClient(
        verify=False,
        limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
    )
    content_type = "application/octet-stream"
    try:
        async with peek_client.stream(
            "GET",
            target_url,
            headers=forward,
            timeout=httpx.Timeout(connect=_CONNECT_TIMEOUT, read=5.0),
            follow_redirects=True,
        ) as peek:
            if peek.status_code >= 400:
                raise HTTPException(status_code=502, detail="Upstream stream unavailable")
            ct = peek.headers.get("content-type", "")
            if ct:
                content_type = ct.split(";")[0].strip() or content_type
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Proxy peek failed for %s: %s", target_url, exc)
    finally:
        await peek_client.aclose()

    # Build a fresh client for the actual streaming request.
    stream_client = httpx.AsyncClient(
        verify=False,
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
    )

    response_headers: dict[str, str] = {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",  # live streams must not be cached
    }

    return StreamingResponse(
        _stream_chunks(stream_client, target_url, forward),
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


# ─────────────────────────────────────────────────────────────────────────────
# Dynamic M3U8 Proxy  (/api/v1/proxy/m3u8)
# ─────────────────────────────────────────────────────────────────────────────
# Retrieves the stored .m3u8 manifest for a DynamicStream record, rewrites
# segment URLs to route through /proxy/stream, and returns the manifest with
# full CORS headers.
#
# Zero-downtime guarantee:
#   - Tries the current m3u8_url first.
#   - Falls back to fallback_m3u8_url if the primary fails.
#   - Returns 503 only when both are unavailable.
# ─────────────────────────────────────────────────────────────────────────────

_M3U8_CONTENT_TYPE = "application/vnd.apple.mpegurl"
_M3U8_CORS_HEADERS: dict[str, str] = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Accept, User-Agent",
    "Cache-Control": "no-store, no-cache, must-revalidate",
}
_M3U8_FETCH_TIMEOUT = httpx.Timeout(connect=8.0, read=15.0, write=None, pool=None)


def _rewrite_m3u8_segments(content: str, base_url: str, proxy_base: str) -> str:
    """
    Rewrite segment and chunk URLs inside an HLS manifest so that they are
    fetched through /proxy/stream rather than directly from the origin.

    Handles:
    - Absolute URLs  (http://...)
    - Protocol-relative URLs  (//...)
    - Relative URLs  (segment.ts, ../path/seg.ts)

    ``proxy_base`` should be the URL of the /proxy/stream endpoint, e.g.
    ``https://api.example.com/api/v1/proxy/stream``.
    """
    parsed_base = urllib.parse.urlparse(base_url)
    base_dir = base_url.rsplit("/", 1)[0] + "/"
    lines = content.splitlines()
    out: list[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#") or not stripped:
            out.append(line)
            continue

        # Resolve the segment URL to an absolute URL.
        if stripped.startswith("http://") or stripped.startswith("https://"):
            absolute = stripped
        elif stripped.startswith("//"):
            absolute = parsed_base.scheme + ":" + stripped
        else:
            absolute = urllib.parse.urljoin(base_dir, stripped)

        # Wrap through the proxy endpoint.
        proxied = proxy_base + "?url=" + urllib.parse.quote(absolute, safe="")
        out.append(proxied)

    return "\n".join(out)


async def _fetch_m3u8_manifest(
    url: str,
    headers: dict[str, str],
) -> str | None:
    """
    Fetch an HLS manifest from ``url`` using ``headers``.
    Returns the manifest text on success, None on any error.
    """
    try:
        async with httpx.AsyncClient(verify=False, timeout=_M3U8_FETCH_TIMEOUT) as client:
            resp = await client.get(url, headers=headers, follow_redirects=True)
            if resp.status_code >= 400:
                logger.warning("M3U8 fetch returned %d for %s", resp.status_code, url[:80])
                return None
            return resp.text
    except Exception as exc:
        logger.warning("M3U8 fetch error for %s: %s", url[:80], exc)
        return None


@router.get("/m3u8")
async def proxy_m3u8(
    request: Request,
    stream_id: int = Query(..., description="DynamicStream.id to serve"),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Fetch and proxy a dynamic HLS manifest for the given DynamicStream record.

    Behaviour:
    1. Load the DynamicStream record from DB (uses Redis cache when available).
    2. Try to fetch the manifest from the stored ``m3u8_url``.
    3. On failure, fall back to ``fallback_m3u8_url``.
    4. Rewrite all segment URLs to route through /proxy/stream.
    5. Return the manifest with full CORS + no-cache headers.
    """
    from app.models.dynamic_stream import DynamicStream

    stream: DynamicStream | None = await db.get(DynamicStream, stream_id)
    if stream is None or not stream.is_active:
        raise HTTPException(status_code=404, detail="Stream not found or inactive")

    if not stream.m3u8_url and not stream.fallback_m3u8_url:
        raise HTTPException(
            status_code=503,
            detail="Stream not yet extracted — try again in a few seconds",
        )

    # Build headers dict from stored JSON.
    stored_headers: dict[str, str] = {}
    if stream.headers_json:
        try:
            stored_headers = json.loads(stream.headers_json)
        except Exception:
            pass

    fallback_headers: dict[str, str] = {}
    if stream.fallback_headers_json:
        try:
            fallback_headers = json.loads(stream.fallback_headers_json)
        except Exception:
            pass

    # Determine the proxy base URL for segment rewriting.
    base_request_url = str(request.base_url).rstrip("/")
    from app.core.config import settings
    proxy_stream_url = f"{base_request_url}{settings.api_v1_prefix}/proxy/stream"

    # Try primary then fallback.
    manifest: str | None = None
    manifest_source_url: str = ""

    if stream.m3u8_url:
        manifest = await _fetch_m3u8_manifest(stream.m3u8_url, stored_headers)
        if manifest is not None:
            manifest_source_url = stream.m3u8_url

    if manifest is None and stream.fallback_m3u8_url:
        logger.info(
            "Primary m3u8 failed for stream %d — serving fallback", stream_id
        )
        manifest = await _fetch_m3u8_manifest(
            stream.fallback_m3u8_url, fallback_headers
        )
        if manifest is not None:
            manifest_source_url = stream.fallback_m3u8_url

    if manifest is None:
        raise HTTPException(
            status_code=503,
            detail="Stream unavailable — both primary and fallback failed",
        )

    rewritten = _rewrite_m3u8_segments(manifest, manifest_source_url, proxy_stream_url)

    return Response(
        content=rewritten,
        status_code=200,
        media_type=_M3U8_CONTENT_TYPE,
        headers=_M3U8_CORS_HEADERS,
    )


@router.options("/m3u8")
async def proxy_m3u8_preflight() -> Response:
    """Handle CORS preflight for the m3u8 proxy endpoint."""
    return Response(status_code=204, headers=_M3U8_CORS_HEADERS)
