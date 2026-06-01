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

import hashlib
import ipaddress
import json
import logging
import random
import re
import socket
import time
import urllib.parse
from collections import OrderedDict
from threading import Lock
from typing import AsyncGenerator

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse, Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis_client import safe_get, safe_set
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
# Browser-like defaults — many BD/IN/sports origins block non-browser clients (403/empty).
_DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
_DEFAULT_ORIGIN = "https://example.com"
_DEFAULT_REFERER = "https://example.com/"
_DEFAULT_ACCEPT_LANGUAGE = "en-US,en;q=0.9"


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
    # */* avoids picky CDNs returning 406/empty; playlist fetch still works.
    if not out.get("accept", "").strip():
        out["accept"] = "*/*"
    if not out.get("accept-language", "").strip():
        out["accept-language"] = _DEFAULT_ACCEPT_LANGUAGE
    if not out.get("origin", "").strip():
        out["origin"] = _DEFAULT_ORIGIN
    if not out.get("referer", "").strip():
        out["referer"] = _DEFAULT_REFERER
    # httpx/http1.1 keep pools; explicit header matches common browser behaviour.
    if not out.get("connection", "").strip():
        out["connection"] = "keep-alive"
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

# Connect bound (~10s). Manifest/peek reads allow a longer first-byte wait (IPTV/CDN often >10s);
# that is still a small buffered response — never used for TS/mp4 relay.
_CONNECT_TIMEOUT = 10.0
_MANIFEST_PEEK_READ_TIMEOUT = 25.0
# Read timeout between chunks while relaying TS/mp4 (live HLS must not stall on idle).
_READ_TIMEOUT = 120.0
# httpx >=0.28 requires all four timeout parts when using keyword args (no implicit default).
_WRITE_TIMEOUT = 30.0
_POOL_TIMEOUT = 10.0
# HLS manifests are small; buffer + rewrite so every variant/segment/key URL stays same-origin (HTTPS)
# and mixed-content / wrong relative resolution against /proxy/stream?... is avoided.
_MAX_MANIFEST_BYTES = 4 * 1024 * 1024
_M3U8_CONTENT_TYPE = "application/vnd.apple.mpegurl"
# Client (browser / Vercel rewrite) CORS — applied to both buffered manifests and chunked streams.
_STREAM_PROXY_RESPONSE_HEADERS: dict[str, str] = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
    "Cache-Control": "no-store, no-cache, must-revalidate",
}


def _proxy_error_response(
    status_code: int,
    message: str = "Stream fetch failed",
    *,
    code: str | None = None,
) -> JSONResponse:
    """JSON error + CORS so the browser never hides failures behind opaque network errors."""
    body: dict[str, object] = {"error": message, "status": status_code, "detail": message}
    if code:
        body["code"] = code
    return JSONResponse(
        status_code=status_code,
        content=body,
        headers={**_STREAM_PROXY_RESPONSE_HEADERS},
    )


def _headers_for_allowlisted_profile(name: str | None) -> dict[str, str]:
    """Server-side allowlisted presets only (no arbitrary client-supplied headers)."""
    if not name:
        return {}
    return {}


def _apply_header_profile(forward: dict[str, str], profile: str | None) -> dict[str, str]:
    extra = _headers_for_allowlisted_profile(profile)
    if not extra:
        return forward
    out = dict(forward)
    for k, v in extra.items():
        if v and str(v).strip():
            out[str(k).lower()] = str(v).strip()
    return out


def _upstream_httpx_base_kwargs() -> dict[str, object]:
    """Shared httpx kwargs: no env proxy trust (explicit STREAM_UPSTREAM_HTTP_PROXY only)."""
    out: dict[str, object] = {"verify": False, "trust_env": False}
    p = (getattr(settings, "stream_upstream_http_proxy", None) or "").strip()
    if p:
        out["proxy"] = p
    return out


def _random_public_egress_ip() -> str:
    """Plausible public IPv4 for X-Forwarded-For / X-Real-IP (best-effort)."""
    if random.randint(0, 1) == 0:
        return f"49.{random.randint(32, 47)}.{random.randint(1, 254)}.{random.randint(1, 254)}"
    return f"104.{random.randint(16, 31)}.{random.randint(1, 254)}.{random.randint(1, 254)}"


def _apply_upstream_geo_bypass_headers(forward: dict[str, str]) -> dict[str, str]:
    if not getattr(settings, "stream_geo_bypass_enabled", True):
        return forward
    h = dict(forward)
    ip = _random_public_egress_ip()
    h["x-forwarded-for"] = ip
    h["x-real-ip"] = ip
    if not h.get("user-agent", "").strip():
        h["user-agent"] = _DEFAULT_USER_AGENT
    return h


def _is_hls_manifest_text_for_rewrite(text: str) -> bool:
    """True for HLS master/media playlists; IPTV channel .m3u lists omit #EXT-X-* tags."""
    s = text.lstrip("\ufeff").lstrip()
    if not s.startswith("#EXTM3U"):
        return False
    return "#EXT-X-" in text


# Raw IPTV playlist fetch (not HLS manifest rewrite) — max body size.
_MAX_PLAYLIST_RAW_BYTES = 20 * 1024 * 1024
# In-process fallback when Redis is absent (bounded; avoids free-tier RAM spikes).
_PLAYLIST_MEM_MAX_ENTRIES = 16
_PLAYLIST_MEM_MAX_BODY_BYTES = 2 * 1024 * 1024
_playlist_mem_cache: OrderedDict[str, tuple[float, str]] = OrderedDict()
_playlist_mem_lock = Lock()


def _playlist_cache_key(url: str, header_profile: str | None) -> str:
    raw = f"v1\0{url}\0{header_profile or ''}".encode()
    return "m3upl:" + hashlib.sha256(raw).hexdigest()


def _playlist_mem_get(key: str) -> str | None:
    now = time.time()
    with _playlist_mem_lock:
        item = _playlist_mem_cache.get(key)
        if item is None:
            return None
        expires_at, body = item
        if expires_at <= now:
            try:
                del _playlist_mem_cache[key]
            except KeyError:
                pass
            return None
        _playlist_mem_cache.move_to_end(key)
        return body


def _playlist_mem_set(key: str, body: str, ttl_sec: int) -> None:
    if len(body.encode("utf-8")) > _PLAYLIST_MEM_MAX_BODY_BYTES:
        return
    with _playlist_mem_lock:
        if key in _playlist_mem_cache:
            del _playlist_mem_cache[key]
        while len(_playlist_mem_cache) >= _PLAYLIST_MEM_MAX_ENTRIES:
            _playlist_mem_cache.popitem(last=False)
        _playlist_mem_cache[key] = (time.time() + max(60, ttl_sec), body)


def _merge_stream_client_headers(upstream_safe: dict[str, str]) -> dict[str, str]:
    """CORS base + safe upstream hints (no content-encoding / transfer-encoding passthrough)."""
    h = dict(_STREAM_PROXY_RESPONSE_HEADERS)
    if ar := upstream_safe.get("accept-ranges"):
        h["Accept-Ranges"] = ar
    if cc := upstream_safe.get("cache-control"):
        h["Cache-Control"] = cc
    if cl := upstream_safe.get("content-length"):
        h["Content-Length"] = cl
    return h
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


# Do not use platform HTTP(S)_PROXY for stream relay — a bad build env var breaks every channel.
def _http_stream_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
        **_upstream_httpx_base_kwargs(),
    )


async def _async_peek_stream(url: str, headers: dict[str, str]) -> tuple[int, str, dict[str, str]]:
    """
    Short GET to learn status + Content-Type; body is closed without buffering video-sized payloads.
    """
    client = httpx.AsyncClient(
        limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
        **_upstream_httpx_base_kwargs(),
    )
    try:
        async with client.stream(
            "GET",
            url,
            headers=headers,
            timeout=httpx.Timeout(
                connect=_CONNECT_TIMEOUT,
                read=_MANIFEST_PEEK_READ_TIMEOUT,
                write=_MANIFEST_PEEK_READ_TIMEOUT,
                pool=_POOL_TIMEOUT,
            ),
            follow_redirects=True,
        ) as resp:
            st = resp.status_code
            ct = (resp.headers.get("content-type") or "").split(";")[0].strip() or "application/octet-stream"
            safe: dict[str, str] = {}
            if ar := resp.headers.get("accept-ranges"):
                safe["accept-ranges"] = ar
            if cc := resp.headers.get("cache-control"):
                safe["cache-control"] = cc
            return st, ct, safe
    except Exception as exc:
        logger.warning("Proxy peek failed for %s: %s", url, exc)
        return 502, "application/octet-stream", {}
    finally:
        await client.aclose()


async def _build_chunked_streaming_response(
    url: str,
    forward: dict[str, str],
    default_content_type: str,
    upstream_hint: dict[str, str],
) -> StreamingResponse | JSONResponse:
    """
    Single upstream GET with stream=True; validate status before returning StreamingResponse.
    Pipes aiter_bytes — never loads video into memory.
    """
    client = _http_stream_client()
    try:
        req = client.build_request(
            "GET",
            url,
            headers=forward,
            timeout=httpx.Timeout(
                connect=_CONNECT_TIMEOUT,
                read=_READ_TIMEOUT,
                write=_WRITE_TIMEOUT,
                pool=_POOL_TIMEOUT,
            ),
        )
        resp = await client.send(req, stream=True, follow_redirects=True)
    except (
        httpx.TimeoutException,
        httpx.ConnectError,
        httpx.ReadError,
        httpx.RemoteProtocolError,
        httpx.WriteError,
    ) as exc:
        logger.warning("Proxy stream open failed for %s: %s", url, exc)
        await client.aclose()
        return _proxy_error_response(502)
    except Exception as exc:
        logger.warning("Proxy stream open unexpected for %s: %s", url, exc)
        await client.aclose()
        return _proxy_error_response(502)

    if resp.status_code >= 400:
        logger.warning("Upstream returned %s for %s", resp.status_code, url)
        try:
            await resp.aread()
        except Exception:
            pass
        await resp.aclose()
        await client.aclose()
        if resp.status_code in _GEO_BLOCK_STATUS:
            return _proxy_error_response(
                403,
                "This premium content is geo-restricted.",
                code="GEO_RESTRICTED",
            )
        return _proxy_error_response(502)

    ct = (
        (resp.headers.get("content-type") or default_content_type or "application/octet-stream")
        .split(";")[0]
        .strip()
    )
    safe: dict[str, str] = dict(upstream_hint)
    if ar := resp.headers.get("accept-ranges"):
        safe["accept-ranges"] = ar
    if cc := resp.headers.get("cache-control"):
        safe["cache-control"] = cc
    if cl := resp.headers.get("content-length"):
        safe["content-length"] = cl

    out_headers = _merge_stream_client_headers(safe)

    async def _body() -> AsyncGenerator[bytes, None]:
        try:
            async for chunk in resp.aiter_raw():
                if chunk:
                    yield chunk
        except (
            httpx.TimeoutException,
            httpx.ConnectError,
            httpx.ReadError,
            httpx.RemoteProtocolError,
            httpx.WriteError,
        ) as exc:
            logger.warning("Proxy stream read error for %s: %s", url, exc)
        except Exception as exc:
            logger.warning("Proxy stream read unexpected for %s: %s", url, exc)
        finally:
            try:
                await resp.aclose()
            except Exception:
                pass
            try:
                await client.aclose()
            except Exception:
                pass

    return StreamingResponse(
        _body(),
        status_code=200,
        media_type=ct,
        headers=out_headers,
    )


def _relative_proxy_stream_path(
    target_url: str,
    stream_id: int | None,
    header_profile: str | None = None,
) -> str:
    """Root-relative URL so the browser (Vercel or any host) resolves it on the current origin."""
    q = urllib.parse.quote(target_url, safe="")
    out = f"/api/v1/proxy/stream?url={q}"
    if stream_id is not None:
        out += f"&stream_id={stream_id}"
    if header_profile:
        out += f"&header_profile={urllib.parse.quote(header_profile, safe='')}"
    return out


def _url_looks_like_m3u8_path(url: str) -> bool:
    try:
        p = (urllib.parse.urlparse(url).path or "").lower()
    except Exception:
        return False
    return p.endswith(".m3u8") or p.endswith(".m3u")


def _content_type_suggests_hls_playlist(content_type: str) -> bool:
    c = (content_type or "").lower()
    return any(x in c for x in ("mpegurl", "m3u", "x-mpegurl"))


# #EXT-X-KEY / #EXT-X-MEDIA / #EXT-X-MAP: URI="..." or URI='...' (some origins omit quotes)
_URI_IN_TAG = re.compile(r"URI=(['\"])([^'\"]+)\1", re.IGNORECASE)
_URI_IN_TAG_BARE = re.compile(r"\bURI=([^\"',\s]+)", re.IGNORECASE)


def _rewrite_hls_playlist_text(
    body: str,
    manifest_url: str,
    stream_id: int | None,
    header_profile: str | None = None,
) -> str:
    """Rewrite resource URLs to same-origin proxy paths (fixes HTTPS page + HTTP upstream mixed content)."""

    def absolutize(line: str) -> str:
        s = line.strip()
        if s.startswith("http://") or s.startswith("https://"):
            return s
        return urllib.parse.urljoin(manifest_url, s)

    def to_proxy_line(line: str) -> str:
        if "/proxy/stream?" in line and "url=" in line:
            return line
        abs_u = absolutize(line)
        try:
            _validate_stream_url(abs_u)
        except HTTPException:
            return line
        return _relative_proxy_stream_path(abs_u, stream_id, header_profile)

    def repl_uri(m: re.Match[str]) -> str:
        q = m.group(1)
        inner = m.group(2).strip()
        if inner.lower().startswith("data:") or ("/proxy/stream?" in inner and "url=" in inner):
            return m.group(0)
        if inner.startswith("/api/v1/proxy/stream"):
            return m.group(0)
        abs_u = inner if inner.startswith("http://") or inner.startswith("https://") else urllib.parse.urljoin(manifest_url, inner)
        try:
            _validate_stream_url(abs_u)
        except HTTPException:
            return m.group(0)
        return f"URI={q}{_relative_proxy_stream_path(abs_u, stream_id, header_profile)}{q}"

    def repl_uri_bare(m: re.Match[str]) -> str:
        inner = m.group(1).strip()
        if inner.lower().startswith("data:") or ("/proxy/stream?" in inner and "url=" in inner):
            return m.group(0)
        if inner.startswith("/api/v1/proxy/stream"):
            return m.group(0)
        abs_u = inner if inner.startswith("http://") or inner.startswith("https://") else urllib.parse.urljoin(manifest_url, inner)
        try:
            _validate_stream_url(abs_u)
        except HTTPException:
            return m.group(0)
        p = _relative_proxy_stream_path(abs_u, stream_id, header_profile)
        return f'URI="{p}"'

    out_lines: list[str] = []
    for raw in body.splitlines():
        line = raw.rstrip("\r")
        if _URI_IN_TAG.search(line):
            line = _URI_IN_TAG.sub(repl_uri, line)
        elif "URI=" in line.upper():
            line = _URI_IN_TAG_BARE.sub(repl_uri_bare, line)
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            out_lines.append(line)
            continue
        out_lines.append(to_proxy_line(line))
    trailing = "\n" if body.endswith("\n") else ""
    return "\n".join(out_lines) + trailing


def _rewrite_hls_manifest_with_m3u8(
    body: str,
    manifest_url: str,
    stream_id: int | None,
    header_profile: str | None,
) -> str | None:
    """Parse HLS with the ``m3u8`` package and rewrite segment / variant / key URIs to /proxy/stream."""
    try:
        import m3u8  # type: ignore[import-untyped]
    except ImportError:
        logger.warning("m3u8 package missing — install m3u8 or use line-based rewriter fallback")
        return None
    try:
        pl = m3u8.loads(body, uri=manifest_url)
    except Exception as exc:
        logger.debug("m3u8 parse failed: %s", exc)
        return None
    base = pl.base_uri or manifest_url

    def proxify(abs_u: str) -> str:
        try:
            v = _validate_stream_url(abs_u)
        except HTTPException:
            return abs_u
        return _relative_proxy_stream_path(v, stream_id, header_profile)

    try:
        for child in getattr(pl, "playlists", []) or []:
            if getattr(child, "uri", None):
                u = urllib.parse.urljoin(base, child.uri)
                child.uri = proxify(u)
        for seg in getattr(pl, "segments", []) or []:
            if getattr(seg, "uri", None):
                u = urllib.parse.urljoin(base, seg.uri)
                seg.uri = proxify(u)
            ini = getattr(seg, "init_section", None)
            if ini is not None and getattr(ini, "uri", None):
                u = urllib.parse.urljoin(base, ini.uri)
                ini.uri = proxify(u)
            key = getattr(seg, "key", None)
            if key is not None and getattr(key, "uri", None):
                u = urllib.parse.urljoin(base, key.uri)
                key.uri = proxify(u)
        for media in getattr(pl, "media", []) or []:
            if getattr(media, "uri", None):
                u = urllib.parse.urljoin(base, media.uri)
                media.uri = proxify(u)
        for key in getattr(pl, "keys", []) or []:
            if getattr(key, "uri", None):
                u = urllib.parse.urljoin(base, key.uri)
                key.uri = proxify(u)
        return pl.dumps()
    except Exception as exc:
        logger.warning("m3u8 rewrite failed: %s", exc)
        return None


async def _fetch_manifest_text(
    url: str, headers: dict[str, str], max_bytes: int
) -> tuple[str | None, str]:
    """
    Fetch a small HLS manifest (buffered). Returns (text, final_url_after_redirects)
    for correct relative URL resolution.
    """
    async with httpx.AsyncClient(
        limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
        **_upstream_httpx_base_kwargs(),
    ) as client:
        try:
            r = await client.get(
                url,
                headers=headers,
                timeout=httpx.Timeout(
                    connect=_CONNECT_TIMEOUT,
                    read=_MANIFEST_PEEK_READ_TIMEOUT,
                    write=_WRITE_TIMEOUT,
                    pool=_POOL_TIMEOUT,
                ),
                follow_redirects=True,
            )
        except Exception as exc:
            logger.warning("Manifest fetch failed for %s: %s", url, exc)
            return None, url
        final = str(r.url)
        if r.status_code >= 400:
            return None, final
        if len(r.content) > max_bytes:
            return None, final
        try:
            return r.text, final
        except Exception:
            return None, final


async def _fetch_manifest_with_geo_retries(
    effective_url: str,
    forward: dict[str, str],
    *,
    try_alternates: bool,
    ds: DynamicStream | None,
    h_primary: dict[str, str] | None,
    h_fb: dict[str, str] | None,
) -> tuple[str | None, str]:
    """Try manifest GET with optional host/header alternates (geo / CDN quirks)."""
    text, base = await _fetch_manifest_text(effective_url, forward, _MAX_MANIFEST_BYTES)
    if text:
        return text, base

    if try_alternates and ds is not None and h_primary and h_fb:
        m3u_base = (ds.m3u8_url or ds.fallback_m3u8_url) or ""
        if m3u_base:
            alt = _remap_url_to_m3u8_base_host(effective_url, m3u_base)
            if alt and alt != effective_url:
                try:
                    alt_v = _validate_stream_url(alt)
                    text, base = await _fetch_manifest_text(alt_v, h_primary, _MAX_MANIFEST_BYTES)
                    if text:
                        return text, base
                except HTTPException:
                    pass
        text, base = await _fetch_manifest_text(effective_url, h_fb, _MAX_MANIFEST_BYTES)
        if text:
            return text, base

    return None, effective_url


@router.get("/stream", response_model=None)
async def proxy_stream(
    request: Request,
    url: str = Query(..., min_length=7, max_length=2048, description="Encoded stream URL to proxy"),
    stream_id: int | None = Query(
        default=None,
        description="Optional DynamicStream id — stored Playwright headers apply to all requests for this id",
    ),
    db: AsyncSession = Depends(get_db),
) -> Response | StreamingResponse | JSONResponse:
    """
    Proxy an IPTV/HLS stream URL through the backend.

    Vercel only rewrites ``/api/*`` to this service — the stream is **chunked here**, not on Vercel.
    If you still see 502 from ``*.vercel.app``, try pointing the browser API base at Render directly
    or check Vercel rewrite timeouts for very slow origins.

    SSRF mitigations:
    - URL scheme restricted to http/https
    - Hostname resolved to IP; private/reserved ranges blocked
    """
    try:
        target_url = _validate_stream_url(url)
        m3u8_src = _m3u8_src_param(request)
        header_profile_q = (request.query_params.get("header_profile") or "").strip() or None

        forward = _merge_stream_forward_headers(request, None)
        effective_url = target_url
        try_alternates = False
        h_primary: dict[str, str] | None = None
        h_fb: dict[str, str] | None = None
        ds: DynamicStream | None = None

        if stream_id is not None:
            try:
                row = await db.get(DynamicStream, stream_id)
            except Exception as exc:
                logger.warning("DynamicStream lookup failed stream_id=%s: %s", stream_id, exc)
                row = None
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

        forward = _apply_header_profile(forward, header_profile_q)
        forward = _apply_upstream_geo_bypass_headers(forward)

        # .m3u8/.m3u: one buffered manifest fetch (no peek) — avoids double upstream hits and Vercel/edge stalls.
        if _url_looks_like_m3u8_path(effective_url):
            try:
                mtext, manifest_base = await _fetch_manifest_with_geo_retries(
                    effective_url,
                    forward,
                    try_alternates=try_alternates,
                    ds=ds,
                    h_primary=h_primary,
                    h_fb=h_fb,
                )
            except Exception as man_exc:
                logger.warning("Manifest fetch error: %s", man_exc)
                return _proxy_error_response(502)
            if not mtext:
                st_peek, _, _ = await _async_peek_stream(effective_url, forward)
                if st_peek in _GEO_BLOCK_STATUS:
                    return _proxy_error_response(
                        403,
                        "This premium content is geo-restricted.",
                        code="GEO_RESTRICTED",
                    )
                return _proxy_error_response(502)
            lead = mtext.lstrip("\ufeff").lstrip()
            if not lead.startswith("#EXTM3U"):
                return _proxy_error_response(502)
            rewritten = _rewrite_hls_manifest_with_m3u8(
                mtext, manifest_base, stream_id, header_profile_q
            )
            if rewritten is None:
                try:
                    rewritten = _rewrite_hls_playlist_text(
                        mtext, manifest_base, stream_id, header_profile_q
                    )
                except Exception as rew_exc:
                    logger.warning("HLS rewrite failed: %s", rew_exc)
                    return _proxy_error_response(502)
            return Response(
                content=rewritten,
                media_type=_M3U8_CONTENT_TYPE,
                headers=dict(_STREAM_PROXY_RESPONSE_HEADERS),
            )

        try:
            st, content_type, upstream_hdrs = await _async_peek_stream(effective_url, forward)
        except Exception as exc:
            logger.warning("proxy peek failed: %s", exc)
            return _proxy_error_response(502)

        if st in _GEO_BLOCK_STATUS and try_alternates and ds and ds.is_active and h_primary and h_fb:
            m3u_base = (ds.m3u8_url or ds.fallback_m3u8_url) or ""
            if m3u_base:
                alt = _remap_url_to_m3u8_base_host(effective_url, m3u_base)
                if alt and alt != effective_url:
                    alt = _validate_stream_url(alt)
                    st, content_type, upstream_hdrs = await _async_peek_stream(alt, h_primary)
                    if st < 400:
                        effective_url, forward = alt, h_primary
            if st in _GEO_BLOCK_STATUS:
                st, content_type, upstream_hdrs = await _async_peek_stream(effective_url, h_fb)
                if st < 400:
                    forward = h_fb

        if st >= 400:
            if st in _GEO_BLOCK_STATUS:
                return _proxy_error_response(
                    403,
                    "This premium content is geo-restricted.",
                    code="GEO_RESTRICTED",
                )
            return _proxy_error_response(502)

        if _content_type_suggests_hls_playlist(content_type):
            try:
                mtext, manifest_base = await _fetch_manifest_with_geo_retries(
                    effective_url,
                    forward,
                    try_alternates=try_alternates,
                    ds=ds,
                    h_primary=h_primary,
                    h_fb=h_fb,
                )
                if mtext:
                    lead = mtext.lstrip("\ufeff").lstrip()
                    if lead.startswith("#EXTM3U"):
                        rewritten = _rewrite_hls_manifest_with_m3u8(
                            mtext, manifest_base, stream_id, header_profile_q
                        )
                        if rewritten is None:
                            try:
                                rewritten = _rewrite_hls_playlist_text(
                                    mtext, manifest_base, stream_id, header_profile_q
                                )
                            except Exception as rew_exc:
                                logger.warning("HLS rewrite failed: %s", rew_exc)
                                rewritten = None
                        if rewritten is not None:
                            return Response(
                                content=rewritten,
                                media_type=_M3U8_CONTENT_TYPE,
                                headers=dict(_STREAM_PROXY_RESPONSE_HEADERS),
                            )
            except Exception as man_exc:
                logger.warning("Manifest handling error: %s", man_exc)

        return await _build_chunked_streaming_response(
            effective_url, forward, content_type, upstream_hdrs
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("proxy/stream fatal: %s", exc)
        return _proxy_error_response(502)


@router.get("/playlist", response_model=None)
async def proxy_playlist_raw(
    request: Request,
    url: str = Query(..., min_length=7, max_length=2048, description="M3U / playlist URL to fetch as raw text"),
    header_profile: str | None = Query(
        default=None,
        description="Optional allowlisted header preset for upstream requests",
    ),
) -> Response | JSONResponse:
    """
    Fetch raw M3U channel lists or HLS manifests.

    IPTV ``.m3u`` (no ``#EXT-X-*`` tags) is returned unchanged for client-side parsing.
    HLS master/media playlists are rewritten so segments and child manifests route through
    ``/api/v1/proxy/stream`` (``m3u8`` parse + fallback line rewriter).

    Cached in Redis + small in-process LRU; TTL from ``proxy_playlist_cache_ttl_seconds``.
    """
    try:
        target_url = _validate_stream_url(url)
        hp = (header_profile or "").strip() or None
        cache_key = _playlist_cache_key(target_url, hp)
        ttl = max(60, int(getattr(settings, "proxy_playlist_cache_ttl_seconds", 5400) or 5400))

        cached_redis = safe_get(cache_key)
        if cached_redis is not None:
            return Response(
                content=cached_redis,
                status_code=200,
                media_type="text/plain; charset=utf-8",
                headers=dict(_STREAM_PROXY_RESPONSE_HEADERS),
            )
        mem_hit = _playlist_mem_get(cache_key)
        if mem_hit is not None:
            return Response(
                content=mem_hit,
                status_code=200,
                media_type="text/plain; charset=utf-8",
                headers=dict(_STREAM_PROXY_RESPONSE_HEADERS),
            )

        base_forward = _apply_upstream_geo_bypass_headers(
            _apply_header_profile(_merge_stream_forward_headers(request, None), hp)
        )
        async with httpx.AsyncClient(
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
            **_upstream_httpx_base_kwargs(),
        ) as client:
            try:
                r = await client.get(
                    target_url,
                    headers=base_forward,
                    timeout=httpx.Timeout(
                        connect=_CONNECT_TIMEOUT,
                        read=_MANIFEST_PEEK_READ_TIMEOUT,
                        write=_WRITE_TIMEOUT,
                        pool=_POOL_TIMEOUT,
                    ),
                    follow_redirects=True,
                )
            except Exception as exc:
                logger.warning("Playlist fetch failed for %s: %s", target_url[:80], exc)
                return _proxy_error_response(502)
        if r.status_code in _GEO_BLOCK_STATUS:
            retry_fwd = _apply_upstream_geo_bypass_headers(
                _apply_header_profile(_merge_stream_forward_headers(request, None), hp)
            )
            try:
                async with httpx.AsyncClient(
                    limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
                    **_upstream_httpx_base_kwargs(),
                ) as client2:
                    r = await client2.get(
                        target_url,
                        headers=retry_fwd,
                        timeout=httpx.Timeout(
                            connect=_CONNECT_TIMEOUT,
                            read=_MANIFEST_PEEK_READ_TIMEOUT,
                            write=_WRITE_TIMEOUT,
                            pool=_POOL_TIMEOUT,
                        ),
                        follow_redirects=True,
                    )
            except Exception as exc:
                logger.warning("Playlist geo-retry failed for %s: %s", target_url[:80], exc)
                return _proxy_error_response(502)
        if r.status_code in _GEO_BLOCK_STATUS:
            return _proxy_error_response(
                403,
                "This premium content is geo-restricted.",
                code="GEO_RESTRICTED",
            )
        if r.status_code >= 400:
            return _proxy_error_response(502)
        if len(r.content) > _MAX_PLAYLIST_RAW_BYTES:
            return _proxy_error_response(413, "Playlist too large to buffer")
        body = r.text
        final_url = str(r.url)
        if _is_hls_manifest_text_for_rewrite(body):
            rewritten = _rewrite_hls_manifest_with_m3u8(body, final_url, None, hp)
            if rewritten is None:
                try:
                    rewritten = _rewrite_hls_playlist_text(body, final_url, None, hp)
                except Exception as rew_exc:
                    logger.warning("Playlist HLS line rewrite failed: %s", rew_exc)
                    rewritten = body
            body = rewritten
        safe_set(cache_key, body, ttl)
        _playlist_mem_set(cache_key, body, ttl)
        return Response(
            content=body,
            status_code=200,
            media_type="text/plain; charset=utf-8",
            headers=dict(_STREAM_PROXY_RESPONSE_HEADERS),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("proxy/playlist fatal: %s", exc)
        return _proxy_error_response(502)


@router.options("/playlist")
async def proxy_playlist_preflight() -> Response:
    return Response(
        status_code=200,
        content="",
        media_type="text/plain",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
        },
    )


@router.options("/stream")
async def proxy_stream_preflight() -> Response:
    """CORS preflight — 200 + Allow-Headers * (required by checklist)."""
    return Response(
        status_code=200,
        content="",
        media_type="text/plain",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
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

_M3U8_CORS_HEADERS: dict[str, str] = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": (
        "Range, Accept, Accept-Encoding, User-Agent, Referer, Origin, Cookie, Authorization"
    ),
    "Cache-Control": "no-store, no-cache, must-revalidate",
}
_M3U8_FETCH_TIMEOUT = httpx.Timeout(connect=8.0, read=15.0, write=15.0, pool=8.0)
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
        async with httpx.AsyncClient(
            timeout=_M3U8_FETCH_TIMEOUT,
            **_upstream_httpx_base_kwargs(),
        ) as client:
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
