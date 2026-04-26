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
import re
import socket
import urllib.parse
from typing import AsyncGenerator

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.dynamic_stream import DynamicStream

logger = logging.getLogger("app.proxy")

router = APIRouter(prefix="/proxy", tags=["proxy"])

# Upstream request headers: merge DB-captured (Playwright) and incoming request (priority below).
# Lower-case names match httpx/Starlette.
_FORWARD_UPSTREAM_REQUEST_HEADER_NAMES: tuple[str, ...] = (
    "referer",
    "origin",
    "user-agent",
    "cookie",
    "authorization",
    "range",
    "accept",
    "accept-encoding",
    "icy-metadata",
)
_DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; IPTV-Proxy/1.0)"


def _normalize_header_map(obj: object) -> dict[str, str]:
    """Build a str→str map with lower-case header names (JSON from DB may use any casing)."""
    if not isinstance(obj, dict):
        return {}
    out: dict[str, str] = {}
    for k, v in obj.items():
        if v is None:
            continue
        s = v if isinstance(v, str) else str(v)
        if s.strip() == "":
            continue
        out[str(k).lower()] = s
    return out


def _merge_stream_forward_headers(
    request: Request,
    db_headers: dict[str, str] | None,
) -> dict[str, str]:
    """
    Per-header priority: (1) DB / Playwright-stored, (2) this HTTP request, (3) default UA.
    No hardcoded origin/referer — only defaults when still missing.
    """
    base_db = db_headers or {}
    out: dict[str, str] = {}
    for name in _FORWARD_UPSTREAM_REQUEST_HEADER_NAMES:
        d_val = base_db.get(name)
        in_val = request.headers.get(name)
        if d_val and d_val.strip():
            out[name] = d_val.strip()
        elif in_val and in_val.strip():
            out[name] = in_val.strip()
    if not out.get("user-agent", "").strip():
        out["user-agent"] = _DEFAULT_USER_AGENT
    return out


def _merge_stream_forward_headers_for_stream_id(
    request: Request,
    ds: DynamicStream,
) -> dict[str, str]:
    """
    When ``stream_id`` is present, DB headers must apply to *every* upstream
    request for that stream (master playlist, sub-playlists, segments, keys) —
    not only when the URL string-equals the stored m3u8Url.

    Priority: primary ``headers_json``; if absent, use ``fallback_headers_json``.
    Then merge with incoming request and default UA.
    """
    base: dict[str, str] = {}
    if ds.headers_json:
        try:
            base = _normalize_header_map(json.loads(ds.headers_json))
        except Exception:
            base = {}
    if not base and ds.fallback_headers_json:
        try:
            base = _normalize_header_map(json.loads(ds.fallback_headers_json))
        except Exception:
            pass
    return _merge_stream_forward_headers(request, base or None)


# Chunk size for streaming — 64 KB gives good throughput without high memory usage.
_CHUNK_SIZE = 64 * 1024  # 64 KB

# Allowed URL schemes — reject anything that is not http/https.
_ALLOWED_SCHEMES = {"http", "https"}

# Hard timeout for connecting to the upstream origin.
_CONNECT_TIMEOUT = 8.0
# Read timeout: how long to wait between received chunks (long for live streams).
_READ_TIMEOUT = 30.0
# Upstream may block a region; try alternate host / header set (primary vs fallback) before failing.
_GEO_BLOCK_STATUS = (401, 403, 451)

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


def _m3u8_src_param(request: Request) -> str:
    v = (request.query_params.get("m3u8_src") or "").strip().lower()
    return v if v in ("primary", "fallback") else ""


def _remap_url_to_m3u8_base_host(target_url: str, m3u8_base_url: str) -> str | None:
    """If ``target`` is on a different host than the manifest origin, return same path/query on the manifest host."""
    try:
        t = urllib.parse.urlparse(target_url)
        b = urllib.parse.urlparse(m3u8_base_url)
        if not b.netloc or t.netloc == b.netloc:
            return None
        return urllib.parse.urlunparse(
            (b.scheme, b.netloc, t.path, t.params, t.query, t.fragment)
        )
    except Exception:
        return None


def _header_sets_for_stream(request: Request, ds: DynamicStream) -> tuple[dict[str, str], dict[str, str]]:
    """(primary-tuned headers, fallback-tuned headers) for this stream."""
    h_primary = _merge_stream_forward_headers_for_stream_id(request, ds)
    raw_fb: dict[str, str] = {}
    if ds.fallback_headers_json:
        try:
            raw_fb = _normalize_header_map(json.loads(ds.fallback_headers_json))
        except Exception:
            pass
    if not raw_fb and ds.headers_json:
        try:
            raw_fb = _normalize_header_map(json.loads(ds.headers_json))
        except Exception:
            pass
    h_fb = _merge_stream_forward_headers(request, raw_fb or None)
    return h_primary, h_fb


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


async def _stream_body_from_upstream(
    client: httpx.AsyncClient,
    url: str,
    request_headers: dict[str, str],
) -> AsyncGenerator[bytes, None]:
    """
    Yields body chunks from the upstream. Does **not** close ``client`` — the caller
    owns the httpx client lifecycle.
    """
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


async def _async_peek_stream(url: str, headers: dict[str, str]) -> tuple[int, str]:
    """Return (status_code, content-type) from the start of a GET; body not consumed."""
    client = httpx.AsyncClient(
        verify=False,
        limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
    )
    try:
        async with client.stream(
            "GET",
            url,
            headers=headers,
            timeout=httpx.Timeout(connect=_CONNECT_TIMEOUT, read=5.0),
            follow_redirects=True,
        ) as resp:
            st = resp.status_code
            ct = (resp.headers.get("content-type") or "").split(";")[0].strip() or "application/octet-stream"
            return st, ct
    except Exception as exc:
        logger.warning("Proxy peek failed for %s: %s", url, exc)
        return 502, "application/octet-stream"
    finally:
        await client.aclose()


@router.get("/stream")
async def proxy_stream(
    request: Request,
    url: str = Query(..., min_length=7, max_length=2048, description="Encoded stream URL to proxy"),
    stream_id: int | None = Query(
        default=None,
        description="Optional DynamicStream id — stored Playwright headers apply to all requests for this id",
    ),
    db: AsyncSession = Depends(get_db),
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
    target_url = _validate_stream_url(url)
    m3u8_src = _m3u8_src_param(request)

    forward = _merge_stream_forward_headers(request, None)
    effective_url = target_url
    try_alternates = False
    h_primary: dict[str, str] | None = None
    h_fb: dict[str, str] | None = None
    ds: DynamicStream | None = None

    if stream_id is not None:
        row = await db.get(DynamicStream, stream_id)
        if row is not None and row.is_active:
            ds = row
            h_primary, h_fb = _header_sets_for_stream(request, row)
            m3u_base = (row.m3u8_url or row.fallback_m3u8_url) or ""
            m3u_pri, m3u_fb = row.m3u8_url, row.fallback_m3u8_url

            if m3u8_src == "primary" and m3u_pri and m3u_fb and target_url == m3u_fb:
                forward = h_primary
                try_alternates = True
            elif m3u8_src == "fallback" and m3u_fb and m3u_pri and target_url == m3u_pri:
                forward = h_fb
                try_alternates = True
            elif m3u8_src == "fallback" and m3u_fb and target_url == m3u_fb:
                forward = h_fb
                if m3u_base:
                    r = _remap_url_to_m3u8_base_host(target_url, m3u_base)
                    if r and r != target_url:
                        effective_url = _validate_stream_url(r)
            else:
                forward = h_primary
                try_alternates = True
                if m3u_base:
                    r = _remap_url_to_m3u8_base_host(target_url, m3u_base)
                    if r and r != target_url:
                        effective_url = _validate_stream_url(r)

    st, content_type = await _async_peek_stream(effective_url, forward)

    if st in _GEO_BLOCK_STATUS and try_alternates and ds and ds.is_active and h_primary and h_fb:
        m3u_base = (ds.m3u8_url or ds.fallback_m3u8_url) or ""
        if m3u_base:
            alt = _remap_url_to_m3u8_base_host(effective_url, m3u_base)
            if alt and alt != effective_url:
                alt = _validate_stream_url(alt)
                st, content_type = await _async_peek_stream(alt, h_primary)
                if st < 400:
                    effective_url, forward = alt, h_primary
        if st in _GEO_BLOCK_STATUS:
            st, content_type = await _async_peek_stream(effective_url, h_fb)
            if st < 400:
                forward = h_fb

    if st >= 400:
        raise HTTPException(status_code=502, detail="Upstream stream unavailable")

    stream_client = httpx.AsyncClient(
        verify=False,
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
    )
    response_headers: dict[str, str] = {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",  # live streams must not be cached
    }

    async def _stream_body() -> AsyncGenerator[bytes, None]:
        try:
            async for chunk in _stream_body_from_upstream(
                stream_client, effective_url, forward
            ):
                yield chunk
        finally:
            await stream_client.aclose()

    return StreamingResponse(
        _stream_body(),
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
            "Access-Control-Allow-Headers": (
                "Range, Accept, Accept-Encoding, User-Agent, Referer, Origin, Cookie, Authorization"
            ),
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
    "Access-Control-Allow-Headers": (
        "Range, Accept, Accept-Encoding, User-Agent, Referer, Origin, Cookie, Authorization"
    ),
    "Cache-Control": "no-store, no-cache, must-revalidate",
}
_M3U8_FETCH_TIMEOUT = httpx.Timeout(connect=8.0, read=15.0, write=None, pool=None)
# Tag attributes: URI="..." or URI='...' (HLS keys, X-MEDIA, etc.)
_HLS_URI_IN_TAG = re.compile(r"URI=(['\"])([^'\"]+)\1", re.IGNORECASE)


def _resolve_m3u8_href(href: str, base_url: str) -> str:
    """Resolve a reference from an HLS manifest to an absolute http(s) URL."""
    parsed_base = urllib.parse.urlparse(base_url)
    base_dir = base_url.rsplit("/", 1)[0] + "/"
    t = href.strip()
    if t.startswith("http://") or t.startswith("https://"):
        return t
    if t.startswith("//"):
        return parsed_base.scheme + ":" + t
    return urllib.parse.urljoin(base_dir, t)


def _proxied_stream_url(absolute: str, proxy_base: str, stream_id: int, m3u8_src: str) -> str:
    q = "url=" + urllib.parse.quote(absolute, safe="") + f"&stream_id={stream_id}"
    if m3u8_src in ("primary", "fallback"):
        q += f"&m3u8_src={m3u8_src}"
    return f"{proxy_base}?{q}"


def _rewrite_m3u8_segments(
    content: str, base_url: str, proxy_base: str, stream_id: int, m3u8_src: str = "primary"
) -> str:
    """
    Rewrite segment URLs, variant playlist URLs, and tag ``URI=`` references
    (``#EXT-X-KEY``, ``#EXT-X-MEDIA``, …) through ``/proxy/stream`` so the
    backend always forwards stored auth headers.
    """
    base_dir = base_url.rsplit("/", 1)[0] + "/"
    parsed_base = urllib.parse.urlparse(base_url)
    lines = content.splitlines()
    out: list[str] = []

    for line in lines:
        raw = line
        stripped = line.strip()
        if not stripped:
            out.append(line)
            continue
        if stripped.startswith("#"):
            m = _HLS_URI_IN_TAG.search(stripped)
            if m:
                inner = m.group(2)
                if inner.strip().lower().startswith("data:"):
                    out.append(line)
                    continue
                abs_u = _resolve_m3u8_href(inner, base_url)
                enc = m.group(1)
                new_uri = _proxied_stream_url(abs_u, proxy_base, stream_id, m3u8_src)
                repl = f"URI={enc}{new_uri}{enc}"
                new_line = _HLS_URI_IN_TAG.sub(repl, line, count=1)
                out.append(new_line)
            else:
                out.append(line)
            continue
        if stripped.startswith("http://") or stripped.startswith("https://"):
            absolute = stripped
        elif stripped.startswith("//"):
            absolute = parsed_base.scheme + ":" + stripped
        else:
            absolute = urllib.parse.urljoin(base_dir, stripped)
        out.append(_proxied_stream_url(absolute, proxy_base, stream_id, m3u8_src))

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
    stream: DynamicStream | None = await db.get(DynamicStream, stream_id)
    if stream is None or not stream.is_active:
        raise HTTPException(status_code=404, detail="Stream not found or inactive")

    if not stream.m3u8_url and not stream.fallback_m3u8_url:
        raise HTTPException(
            status_code=503,
            detail="Stream not yet extracted — try again in a few seconds",
        )

    h_primary, h_fb = _header_sets_for_stream(request, stream)

    # Determine the proxy base URL for segment rewriting.
    base_request_url = str(request.base_url).rstrip("/")
    from app.core.config import settings
    proxy_stream_url = f"{base_request_url}{settings.api_v1_prefix}/proxy/stream"

    # Try primary then fallback.
    manifest: str | None = None
    manifest_source_url: str = ""
    m3u8_src = "primary"

    if stream.m3u8_url:
        manifest = await _fetch_m3u8_manifest(stream.m3u8_url, h_primary)
        if manifest is not None:
            manifest_source_url = stream.m3u8_url
            m3u8_src = "primary"

    if manifest is None and stream.fallback_m3u8_url:
        logger.info(
            "Primary m3u8 failed for stream %d — serving fallback", stream_id
        )
        manifest = await _fetch_m3u8_manifest(
            stream.fallback_m3u8_url, h_fb
        )
        if manifest is not None:
            manifest_source_url = stream.fallback_m3u8_url
            m3u8_src = "fallback"

    if manifest is None:
        raise HTTPException(
            status_code=503,
            detail="Stream unavailable — both primary and fallback failed",
        )

    rewritten = _rewrite_m3u8_segments(
        manifest, manifest_source_url, proxy_stream_url, stream_id, m3u8_src
    )

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
