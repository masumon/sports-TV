"""
BDIX IPTV Aggregation Engine.

Fetches, parses, deduplicates, and merges BDIX IPTV M3U playlists into
ParsedChannel objects compatible with the existing sync pipeline.

Sources:
  - https://raw.githubusercontent.com/Shadmanislam/bdiptv/master/BD%20IPTV.m3u
  - https://github.com/abusaeeidx/Mrgify-BDIX-IPTV/raw/main/playlist.m3u

Deduplication strategy:
  1. Exact stream URL (case-insensitive)
  2. Normalized channel name fuzzy match — strips quality/status tags,
     folds Unicode to ASCII, collapses whitespace

Cache: 30-minute in-process TTL (avoids hammering GitHub raw.githubusercontent).
"""
from __future__ import annotations

import logging
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.services.iptv_scraper import (
    FETCH_RETRY_DELAYS_SECONDS,
    MAX_FETCH_ATTEMPTS,
    ParsedChannel,
    _get_with_retry,
)

logger = logging.getLogger("app.bdix")

# BDIX playlist sources (actively maintained only; removed dead community repos)
BDIX_SOURCES: list[str] = [
    # iptv-org official Bangladesh country playlist (verified, regularly updated)
    "https://iptv-org.github.io/iptv/countries/bd.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/bd.m3u",
    # Community-maintained BD playlists (World Cup 2026 coverage)
    "https://raw.githubusercontent.com/abusaeeidx/Mrgify-BDIX-IPTV/master/playlist.m3u",
    "https://raw.githubusercontent.com/imShakil/tvlink/refs/heads/main/iptv.m3u8",
]

# India sports sources (actively maintained, verified)
INDIA_SOURCES: list[str] = [
    # IPTVcat India sports (regularly updated)
    "https://raw.githubusercontent.com/iptvcat/indian-iptv/master/indian-iptv.m3u",
]

_FETCH_TIMEOUT = 10.0  # GitHub raw timeout (reduced from 25s for faster fail)
_MAX_WORKERS = 3  # Handles 4 sources with reasonable parallelism
_CACHE_TTL_SECONDS = 1800  # 30 min cache TTL
_cache: dict[str, tuple[list[ParsedChannel], float]] = {}

# Quality/status tag stripper — same pattern as iptv_scraper but extended
_QUALITY_RE = re.compile(
    r"\s*[\[\(]?\s*(?:"
    r"\d{3,4}p|fhd|uhd|4k|hd|sd|"
    r"bdix|iptv|live|"
    r"backup\s*\d*|mirror\s*\d*|alt\s*\d*|"
    r"ch\s*\d+|channel\s*\d+"
    r")\s*[\]\)]?\s*",
    re.IGNORECASE,
)
_NON_ALNUM_RE = re.compile(r"[^a-z0-9\s]")

# EXTINF attribute extractor
_ATTR_RE = re.compile(r'(\w[\w-]*)=["\']([^"\']*)["\']')


def _parse_extinf_attrs(line: str) -> dict[str, str]:
    """Parse all key="value" pairs from an #EXTINF line."""
    return {m.group(1).lower(): m.group(2) for m in _ATTR_RE.finditer(line)}


def _channel_name(line: str) -> str:
    """Extract channel display name from #EXTINF line (after the last comma)."""
    if "," in line:
        return line.rsplit(",", 1)[-1].strip()
    return "BD Channel"


def _normalize_for_dedup(name: str) -> str:
    """Normalize name to ASCII lowercase key for duplicate detection."""
    try:
        name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    except Exception:
        pass
    name = _QUALITY_RE.sub(" ", name)
    name = _NON_ALNUM_RE.sub(" ", name.lower())
    return " ".join(name.split()).strip()


def _parse_bdix_playlist(text: str, source_label: str) -> list[ParsedChannel]:
    """Parse a BDIX M3U text into ParsedChannel list."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    entries: list[ParsedChannel] = []

    for i, line in enumerate(lines):
        if not line.startswith("#EXTINF"):
            continue

        # Advance past any intermediate comment lines to find the stream URL
        j = i + 1
        while j < len(lines) and lines[j].startswith("#"):
            j += 1
        if j >= len(lines):
            continue

        stream_url = lines[j].strip()
        if not stream_url or stream_url.startswith("#"):
            continue
        if not (
            stream_url.startswith("http")
            or stream_url.startswith("rtmp")
            or stream_url.startswith("rtp")
            or stream_url.startswith("udp")
        ):
            continue

        attrs = _parse_extinf_attrs(line)
        name = _channel_name(line)[:255]

        # Metadata with sensible BDIX defaults
        logo = (attrs.get("tvg-logo") or attrs.get("tvg-image") or "")[:1024] or None
        group = (attrs.get("group-title") or "Bangladesh")[:120]
        country = (attrs.get("tvg-country") or "Bangladesh")[:120]
        language = (attrs.get("tvg-language") or "Bengali")[:120]

        entries.append(
            ParsedChannel(
                name=name,
                stream_url=stream_url[:2048],
                logo_url=logo,
                category=group,
                country=country,
                language=language,
                module="bangladesh",
            )
        )

    logger.info("BDIX parse: %d entries from %s", len(entries), source_label[:60])
    return entries


def _fetch_one(url: str) -> list[ParsedChannel]:
    """Fetch + parse a single BDIX source; returns [] on any error."""
    try:
        resp = _get_with_retry(url, timeout=_FETCH_TIMEOUT)
        text = resp.text
        if not text.lstrip().startswith("#EXTM3U"):
            logger.warning("BDIX: non-M3U response from %s", url[:60])
            return []
        return _parse_bdix_playlist(text, url)
    except Exception as exc:
        logger.warning("BDIX fetch failed for %s: %s", url[:60], exc)
        return []


def _deduplicate(entries: list[ParsedChannel]) -> list[ParsedChannel]:
    """
    Remove exact URL duplicates and fuzzy name duplicates.
    When two entries share a normalized name, keep the first one encountered
    (sources are ordered by priority: BDIX_SOURCES[0] > BDIX_SOURCES[1]).
    """
    seen_urls: set[str] = set()
    seen_names: dict[str, int] = {}  # norm_name → first_seen_index
    out: list[ParsedChannel] = []

    for entry in entries:
        url_key = entry.stream_url.strip().lower()
        if url_key in seen_urls:
            continue
        seen_urls.add(url_key)

        norm = _normalize_for_dedup(entry.name)
        if norm and norm in seen_names:
            # Same logical channel from a secondary source — skip as redundant
            continue
        if norm:
            seen_names[norm] = len(out)

        out.append(entry)

    removed = len(entries) - len(out)
    if removed:
        logger.info("BDIX dedup: removed %d duplicates (%d → %d)", removed, len(entries), len(out))
    return out


def fetch_bdix_channels(
    extra_sources: list[str] | None = None,
    force_refresh: bool = False,
) -> list[ParsedChannel]:
    """
    Fetch and merge all configured BDIX IPTV sources.

    Returns a deduplicated list of ParsedChannel objects ready to be
    passed to `sync_channels_from_entries()`.

    Results are cached in-process for `_CACHE_TTL_SECONDS` seconds.
    Pass `force_refresh=True` to bypass the cache.
    """
    cache_key = "bdix_all"
    now = time.monotonic()

    if not force_refresh:
        cached = _cache.get(cache_key)
        if cached is not None:
            entries, ts = cached
            if now - ts < _CACHE_TTL_SECONDS:
                return list(entries)

    sources = list(BDIX_SOURCES)
    if extra_sources:
        for s in extra_sources:
            if s and s not in sources:
                sources.append(s)

    all_entries: list[ParsedChannel] = []
    with ThreadPoolExecutor(max_workers=min(_MAX_WORKERS, len(sources))) as pool:
        futures = {pool.submit(_fetch_one, url): url for url in sources}
        for fut in as_completed(futures):
            url = futures[fut]
            try:
                result = fut.result()
                all_entries.extend(result)
            except Exception as exc:
                logger.warning("BDIX parallel fetch error for %s: %s", url[:60], exc)

    result = _deduplicate(all_entries)
    _cache[cache_key] = (result, now)

    logger.info(
        "BDIX aggregation: %d channels from %d source(s)",
        len(result),
        len(sources),
    )
    return result


def invalidate_bdix_cache() -> None:
    """Force next call to re-fetch all BDIX sources and clear stale cache."""
    global _cache
    _cache.clear()
    logger.info("BDIX cache cleared (will re-fetch on next call)")


def _fetch_one_india(url: str) -> list[ParsedChannel]:
    try:
        resp = _get_with_retry(url, timeout=_FETCH_TIMEOUT)
        text = resp.text
        if not text.lstrip().startswith("#EXTM3U"):
            return []
        entries = _parse_bdix_playlist(text, url)
        for e in entries:
            e.module = "india"
            if not e.country or e.country == "Bangladesh":
                e.country = "India"
            if not e.language or e.language == "Bengali":
                e.language = "Hindi"
        return entries
    except Exception as exc:
        logger.warning("India fetch failed for %s: %s", url[:60], exc)
        return []


def fetch_india_channels(
    extra_sources: list[str] | None = None,
    force_refresh: bool = False,
) -> list[ParsedChannel]:
    """Fetch India channels from iptv-org India playlist."""
    cache_key = "india_all"
    now = time.monotonic()
    if not force_refresh:
        cached = _cache.get(cache_key)
        if cached is not None:
            entries, ts = cached
            if now - ts < _CACHE_TTL_SECONDS:
                return list(entries)
    sources = list(INDIA_SOURCES)
    if extra_sources:
        for s in extra_sources:
            if s and s not in sources:
                sources.append(s)
    all_entries: list[ParsedChannel] = []
    with ThreadPoolExecutor(max_workers=min(_MAX_WORKERS, len(sources))) as pool:
        futures = {pool.submit(_fetch_one_india, url): url for url in sources}
        for fut in as_completed(futures):
            try:
                all_entries.extend(fut.result())
            except Exception as exc:
                logger.warning("India fetch error: %s", exc)
    # Override module to india
    for e in all_entries:
        e.module = "india"
    result = _deduplicate(all_entries)
    _cache[cache_key] = (result, now)
    logger.info("India channels: %d after dedup", len(result))
    return result
