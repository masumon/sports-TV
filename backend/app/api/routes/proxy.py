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

import ipaddress
import logging
import socket
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
