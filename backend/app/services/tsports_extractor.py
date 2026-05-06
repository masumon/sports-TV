"""T-Sports Bangladesh live HLS stream extractor.

Source: https://live.tsports.com/mobile_hls/tsports_live_1/playlist.m3u8
Required headers:
  Host: live.tsports.com
  User-Agent: Tsports (Linux; Android 14)

The Akamai EdgeAuth cookie (Edge-Cache-Cookie) is injected via the
`tsports` header profile already registered in proxy.py. This service
validates the master playlist and parses variant stream options.
"""
from __future__ import annotations

import logging
import time
import urllib.parse
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger("app.tsports")

TSPORTS_MASTER_URL = "https://live.tsports.com/mobile_hls/tsports_live_1/playlist.m3u8"
TSPORTS_HOST = "live.tsports.com"
TSPORTS_DEFAULT_UA = "Tsports (Linux; Android 14)"

_CONNECT_TIMEOUT = 8.0
_READ_TIMEOUT = 15.0
_WRITE_TIMEOUT = 10.0
_POOL_TIMEOUT = 5.0

# Short TTL — master playlist is stable, but token-based CDN cookies rotate.
_CACHE_TTL_SECONDS = 45
_cache: dict[str, tuple[object, float]] = {}


@dataclass
class TSportsVariant:
    url: str
    bandwidth: int
    resolution: str | None = None
    codecs: str | None = None

    @property
    def quality_label(self) -> str:
        if self.resolution:
            h = self.resolution.split("x")[-1]
            try:
                ih = int(h)
                if ih >= 1080:
                    return "1080p"
                if ih >= 720:
                    return "720p"
                if ih >= 480:
                    return "480p"
                return f"{ih}p"
            except ValueError:
                return self.resolution
        bw = self.bandwidth
        if bw >= 4_000_000:
            return "1080p"
        if bw >= 2_000_000:
            return "720p"
        if bw >= 800_000:
            return "480p"
        return "auto"


@dataclass
class TSportsResult:
    master_url: str
    variants: list[TSportsVariant] = field(default_factory=list)
    best_url: str | None = None
    headers: dict[str, str] = field(default_factory=dict)
    validated: bool = False
    error: str | None = None

    @property
    def playback_url(self) -> str:
        return self.best_url or self.master_url


def _build_headers(user_agent: str, cookie: str | None = None) -> dict[str, str]:
    h: dict[str, str] = {
        "host": TSPORTS_HOST,
        "user-agent": user_agent,
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "connection": "keep-alive",
        "origin": "https://tsports.com",
        "referer": "https://tsports.com/",
    }
    if cookie and cookie.strip():
        h["cookie"] = cookie.strip()
    return h


def _parse_variants(manifest: str, base_url: str) -> list[TSportsVariant]:
    """Parse #EXT-X-STREAM-INF entries; sort highest bandwidth first."""
    lines = manifest.splitlines()
    variants: list[TSportsVariant] = []

    for i, line in enumerate(lines):
        if not line.startswith("#EXT-X-STREAM-INF:"):
            continue
        bandwidth = 0
        resolution: str | None = None
        codecs: str | None = None

        attrs_str = line[len("#EXT-X-STREAM-INF:"):].strip()
        # Simple attribute parser — handles BANDWIDTH, RESOLUTION, CODECS
        for part in attrs_str.split(","):
            k, _, v = part.partition("=")
            k = k.strip().upper()
            v = v.strip().strip('"')
            if k == "BANDWIDTH":
                try:
                    bandwidth = int(v)
                except ValueError:
                    pass
            elif k == "RESOLUTION":
                resolution = v
            elif k == "CODECS":
                codecs = v

        # Find the next non-comment line (the URI)
        j = i + 1
        while j < len(lines) and lines[j].startswith("#"):
            j += 1
        if j >= len(lines):
            continue
        uri = lines[j].strip()
        if not uri or uri.startswith("#"):
            continue

        abs_url = uri if uri.startswith("http") else urllib.parse.urljoin(base_url, uri)
        variants.append(
            TSportsVariant(
                url=abs_url,
                bandwidth=bandwidth,
                resolution=resolution,
                codecs=codecs,
            )
        )

    return sorted(variants, key=lambda v: v.bandwidth, reverse=True)


def extract_tsports(
    cookie: str | None = None,
    user_agent: str | None = None,
) -> TSportsResult:
    """
    Fetch the T-Sports master HLS playlist and extract variant streams.

    Caches successful results for `_CACHE_TTL_SECONDS` seconds.
    Cookie/UA changes bypass the cache.
    """
    ua = (user_agent or "").strip() or TSPORTS_DEFAULT_UA
    cache_key = f"tsports:{ua[:32]}:{bool(cookie)}"
    now = time.monotonic()

    cached = _cache.get(cache_key)
    if cached is not None:
        result, ts = cached
        if now - ts < _CACHE_TTL_SECONDS:
            return result  # type: ignore[return-value]

    headers = _build_headers(ua, cookie)
    try:
        with httpx.Client(
            timeout=httpx.Timeout(
                connect=_CONNECT_TIMEOUT,
                read=_READ_TIMEOUT,
                write=_WRITE_TIMEOUT,
                pool=_POOL_TIMEOUT,
            ),
            follow_redirects=True,
            verify=False,
            trust_env=False,
        ) as client:
            resp = client.get(TSPORTS_MASTER_URL, headers=headers)
    except Exception as exc:
        logger.warning("T-Sports fetch failed: %s", exc)
        return TSportsResult(
            master_url=TSPORTS_MASTER_URL,
            headers=headers,
            validated=False,
            error=str(exc),
        )

    if resp.status_code not in (200, 206):
        err = f"HTTP {resp.status_code}"
        logger.warning("T-Sports returned %s for master playlist", resp.status_code)
        return TSportsResult(
            master_url=TSPORTS_MASTER_URL,
            headers=headers,
            validated=False,
            error=err,
        )

    manifest = resp.text
    final_url = str(resp.url)

    if not manifest.lstrip("﻿").lstrip().startswith("#EXTM3U"):
        return TSportsResult(
            master_url=TSPORTS_MASTER_URL,
            headers=headers,
            validated=False,
            error="Response is not a valid HLS manifest",
        )

    variants = _parse_variants(manifest, final_url)
    best_url = variants[0].url if variants else final_url

    result = TSportsResult(
        master_url=TSPORTS_MASTER_URL,
        variants=variants,
        best_url=best_url,
        headers=headers,
        validated=True,
    )
    _cache[cache_key] = (result, now)

    logger.info(
        "T-Sports OK: %d variant(s), best=%s (%s bps)",
        len(variants),
        best_url[:70],
        variants[0].bandwidth if variants else "n/a",
    )
    return result
