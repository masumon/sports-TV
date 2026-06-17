from __future__ import annotations

import hashlib
import json
import logging
import re
import time
import urllib.parse
from collections.abc import Iterable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.channel import Channel
from app.services.channel_cleanup import _merge_alternate_urls

logger = logging.getLogger("app.scraper")

# Channel name / URL patterns → header profile (mirrors proxy.py allowlist).
_HP_URL_PATTERNS: list[tuple[str, str]] = [
    ("tsports.com", "tsports"),
    ("tsportshd", "tsports"),
    ("tsporthd", "tsports"),
    ("live-cdn.tsports", "tsports"),
    ("hotstar.com", "star_sports"),
    ("starsports.com", "star_sports"),
    ("star-sports", "star_sports"),
    ("sonyliv.com", "sony_sports"),
    ("sonyentertainment", "sony_sports"),
    ("executeandship.com", "crichd"),
    ("crichd.com", "crichd"),
    ("sky.com/sport", "sky_sports"),
    ("skysports.com", "sky_sports"),
    ("btsport.com", "bt_sport"),
    ("tntsports.co.uk", "bt_sport"),
    ("maasrangatv.com", "maasranga"),
    ("maasranga.tv", "maasranga"),
    ("gazitv.com", "gazi_tv"),
    ("btv.gov.bd", "btv"),
    ("channelionline.com", "channel_i"),
    ("ntvbd.com", "ntvbd"),
    ("willow.tv", "willow_tv"),
    ("eurosport.com", "eurosport"),
    ("beinsports.com", "bein_sports"),
]

_HP_NAME_PATTERNS: list[tuple[str, str]] = [
    ("t sports", "tsports"),
    ("tsport", "tsports"),
    ("t-sport", "tsports"),
    ("star sports", "star_sports"),
    ("starsports", "star_sports"),
    ("hotstar", "star_sports"),
    ("sony sports", "sony_sports"),
    ("sony ten", "sony_sports"),
    ("sony liv", "sony_sports"),
    ("sonyliv", "sony_sports"),
    ("crichd", "crichd"),
    ("sky sports", "sky_sports"),
    ("skysports", "sky_sports"),
    ("bt sport", "bt_sport"),
    ("tnt sports", "bt_sport"),
    ("maasranga", "maasranga"),
    ("gazi tv", "gazi_tv"),
    ("gazitv", "gazi_tv"),
    ("bangladesh television", "btv"),
    (" btv ", "btv"),
    ("channel i", "channel_i"),
    ("ntv bd", "ntvbd"),
    ("ntvbd", "ntvbd"),
    ("willow", "willow_tv"),
    ("eurosport", "eurosport"),
    ("bein sports", "bein_sports"),
    ("beinsports", "bein_sports"),
]


def _auto_header_profile(name: str, stream_url: str) -> str | None:
    """Return the best header profile for a channel, or None if unknown."""
    u = stream_url.lower()
    n = f" {name.lower()} "
    for pattern, profile in _HP_URL_PATTERNS:
        if pattern in u:
            return profile
    for pattern, profile in _HP_NAME_PATTERNS:
        if pattern in n:
            return profile
    return None

# Regex to strip quality/status tags (in brackets or parens) from channel names
# before grouping, so mirrors with different quality labels group together.
# Examples stripped: (1080p), [Geo-blocked], (HD), [FHD], (720p), [Geo-Blocked]
_CHAN_NORM_RE = re.compile(
    r"\s*[\[\(]"
    r"(?:\d{3,4}p|fhd|uhd|4k|hd|sd|geo[\s\-]?block(?:ed)?|"
    r"stream\s*\d*|backup\s*\d*|mirror\s*\d*|alt\s*\d*|live|auto|main|primary)"
    r"[\]\)]\s*",
    re.IGNORECASE,
)
_CHAN_SUFFIX_NORM_RE = re.compile(
    r"\s+(?:\d{3,4}p|fhd|uhd|4k|hd|sd|live|auto|main|primary)\s*$",
    re.IGNORECASE,
)
_GEO_BLOCK_HINT_RE = re.compile(
    r"(?:geo[\s\-]?block(?:ed)?|region[\s\-]?(?:lock(?:ed)?|restrict(?:ed)?)|country[\s\-]?(?:lock(?:ed)?|restrict(?:ed)?))",
    re.IGNORECASE,
)
# Kodi playlist metadata sometimes lands in EXTINF names — not real channels.
_KODIPROP_NAME_RE = re.compile(r"^#?\s*KODIPROP:", re.IGNORECASE)
_JUNK_NAME_RE = re.compile(r"^#(?:EXT|EXTINF|EXTVLCOPT|KODIPROP)", re.IGNORECASE)

REQUEST_TIMEOUT_SECONDS = 10  # Reduced from 15s (faster fail on dead sources)
FETCH_RETRY_DELAYS_SECONDS = (1, 2, 4)  # Reduced retry delays
MAX_FETCH_ATTEMPTS = 3  # Reduced from 5 (fail faster on truly dead sources)
HTTP_HEADERS = {
    "User-Agent": "ABOSportsTV/1.0 (+https://abosportstv.com; IPTV sync bot)",
    "Accept": "application/vnd.apple.mpegurl, audio/mpegurl, application/x-mpegURL, */*",
}

# ─────────────────────────────────────────────────────────────────────────────
# M3U Source Definitions
# ─────────────────────────────────────────────────────────────────────────────

# Sports category playlists — high-quality, actively maintained sources only
SPORTS_CATEGORY_SOURCES: list[str] = [
    # iptv-org official sports categories (global, maintained, high quality)
    "https://iptv-org.github.io/iptv/categories/sports.m3u",
    "https://iptv-org.github.io/iptv/categories/football.m3u",
    "https://iptv-org.github.io/iptv/categories/cricket.m3u",
    "https://iptv-org.github.io/iptv/categories/basketball.m3u",
    "https://iptv-org.github.io/iptv/categories/tennis.m3u",
    "https://iptv-org.github.io/iptv/categories/motor_sports.m3u",
    "https://iptv-org.github.io/iptv/categories/boxing.m3u",
    # LegalStream — curated global sports (NFL, NCAA, Soccer, Cricket, etc.)
    "https://raw.githubusercontent.com/notanewbie/LegalStream/master/packages/sports/live.m3u8",
    # FreeTVCast — maintained sports selection
    "https://raw.githubusercontent.com/CTOTechnologies/FreeIPTV/master/categories/sports.m3u",
]

# India — regional sports sources (actively maintained)
INDIA_FULL_SOURCES: list[str] = [
    # iptv-org India country list (official, maintained)
    "https://iptv-org.github.io/iptv/countries/in.m3u",
    # IPTVcat India IPTV (regularly updated)
    "https://raw.githubusercontent.com/iptvcat/indian-iptv/master/indian-iptv.m3u",
]

# Bangladesh — regional sources (vetted, maintained)
BANGLADESH_SOURCES: list[str] = [
    # iptv-org official Bangladesh (verified, maintained)
    "https://iptv-org.github.io/iptv/countries/bd.m3u",
]

# Global sports FAST channels (24/7 linear streams, low-latency)
GLOBAL_FAST_SOURCES: list[str] = [
    # Pluto TV — verified FAST channels (24/7 streams)
    "https://raw.githubusercontent.com/Freeaqingme/TV-Playlist/main/pluto.m3u",
]

# World sports: category playlists only (no mixed country lists to avoid bloat)
DEFAULT_M3U_SOURCES: list[str] = SPORTS_CATEGORY_SOURCES
SPORTS_M3U_URL = SPORTS_CATEGORY_SOURCES[0]

# Sports keyword filter (applied to mixed country playlists)
SPORTS_KEYWORDS: frozenset[str] = frozenset({
    "sport", "sports", "football", "soccer", "cricket", "basketball", "tennis",
    "baseball", "rugby", "hockey", "golf", "boxing", "ufc", "mma", "martial",
    "formula", "f1", "racing", "motorsport", "motor", "nascar", "indycar",
    "cycling", "athletics", "swimming", "volleyball", "badminton", "snooker",
    "darts", "wrestling", "wwe", "esport", "olympic", "game", "arena",
    "stadium", "liga", "ligue", "bundesliga", "premier", "laliga", "serie",
    "champions", "champion", "euro", "copa", "cup", "match", "score",
    "ipl", "bpl", "psl", "nba", "nfl", "nhl", "mlb",
    "eurosport", "beinsport", "bein sport", "supersport", "dazn",
    "sky sport", "skysport", "bt sport", "espn", "fox sport",
    "eleven sport", "setanta", "star sport", "sony sport", "willow",
    "ten sport", "geo super", "ptv sport", "rcb", "csk",
})

# Global sports module identifier
GLOBAL_SPORTS_MODULE = "global_sports"


def _dedupe_entries_by_stream_url_priority(entries: list[ParsedChannel]) -> list[ParsedChannel]:
    # Simple dedup: first occurrence wins (sources are ordered by quality/maintenance)
    by_url: dict[str, ParsedChannel] = {}
    for e in entries:
        url_key = e.stream_url.strip().lower()
        if url_key not in by_url:
            by_url[url_key] = e
    return list(by_url.values())


@dataclass(slots=True)
class ParsedChannel:
    name: str
    stream_url: str
    logo_url: str | None
    category: str
    country: str
    language: str
    module: str = GLOBAL_SPORTS_MODULE
    geo_hint: bool = False


def _extract_attr(line: str, key: str) -> str | None:
    token = f'{key}="'
    if token not in line:
        return None
    start = line.index(token) + len(token)
    end = line.find('"', start)
    if end == -1:
        return None
    value = line[start:end].strip()
    return value or None


def parse_m3u_entries(
    playlist_text: str,
    sports_only: bool = False,
    module: str = GLOBAL_SPORTS_MODULE,
) -> list[ParsedChannel]:
    lines = [line.strip() for line in playlist_text.splitlines() if line.strip()]
    entries: list[ParsedChannel] = []

    for index, line in enumerate(lines):
        if not line.startswith("#EXTINF"):
            continue
        j = index + 1
        while j < len(lines) and lines[j].startswith("#"):
            j += 1
        if j >= len(lines):
            continue

        stream_url = lines[j].strip()
        if not _is_valid_stream_url(stream_url):
            continue

        raw_name = line.split(",", 1)[1].strip() if "," in line else "Unknown Channel"
        if _is_junk_channel_name(raw_name):
            continue
        default_cat = "Sports" if module == GLOBAL_SPORTS_MODULE else "General"
        category = (_extract_attr(line, "group-title") or default_cat)[:120]
        geo_hint = bool(_GEO_BLOCK_HINT_RE.search(f"{raw_name} {category}"))
        name = _display_channel_name(raw_name)
        if _is_junk_channel_name(name):
            continue

        if sports_only:
            name_lower = name.lower()
            cat_lower = category.lower()
            if not any(kw in name_lower or kw in cat_lower for kw in SPORTS_KEYWORDS):
                continue

        entries.append(
            ParsedChannel(
                name=name[:255],
                stream_url=stream_url[:2048],
                logo_url=(_extract_attr(line, "tvg-logo") or "")[:1024] or None,
                category=category,
                country=(_extract_attr(line, "tvg-country") or "Global")[:120],
                language=(_extract_attr(line, "tvg-language") or "Unknown")[:120],
                module=module,
                geo_hint=geo_hint,
            )
        )

    return entries


def _get_with_retry(url: str, *, timeout: float | None = None) -> requests.Response:
    timeout_s = float(REQUEST_TIMEOUT_SECONDS if timeout is None else timeout)
    last_exc: Exception | None = None
    for attempt in range(1, MAX_FETCH_ATTEMPTS + 1):
        try:
            response = requests.get(url, timeout=timeout_s, headers=HTTP_HEADERS)
            response.raise_for_status()
            return response
        except Exception as exc:
            last_exc = exc
            if attempt >= MAX_FETCH_ATTEMPTS:
                break
            delay = FETCH_RETRY_DELAYS_SECONDS[min(attempt - 1, len(FETCH_RETRY_DELAYS_SECONDS) - 1)]
            logger.warning(
                "M3U fetch retry scheduled url=%s attempt=%d/%d delay=%ss error=%s",
                url,
                attempt + 1,
                MAX_FETCH_ATTEMPTS,
                delay,
                exc,
            )
            time.sleep(delay)
    raise RuntimeError(f"M3U fetch failed after {MAX_FETCH_ATTEMPTS} attempts: {url}") from last_exc


def fetch_sports_m3u(url: str | None = None) -> str:
    source_url = url or settings.scraper_source_url or SPORTS_M3U_URL
    response = _get_with_retry(source_url, timeout=None)
    body = response.text
    if not body.strip().startswith("#EXTM3U"):
        raise ValueError("Invalid M3U source received.")
    return body


def _fetch_m3u_safe(url: str, *, timeout_seconds: float | None = None) -> str | None:
    """Fetch a single M3U source; return None on any error (don't abort the whole sync).

    Redis cache: playlist text is cached for 25 min so back-to-back syncs
    (e.g., manual + scheduled) do not hammer upstream servers.
    If Redis is down the HTTP fetch runs normally — no change in behaviour.
    """
    from app.core.redis_client import safe_get, safe_set

    cache_key = "gstv:m3u:" + hashlib.sha256(url.encode()).hexdigest()[:20]
    cached = safe_get(cache_key)
    if cached is not None:
        logger.debug("M3U cache HIT: %s", url)
        return cached

    try:
        response = _get_with_retry(url, timeout=timeout_seconds)
        body = response.text
        if body.strip().startswith("#EXTM3U"):
            safe_set(cache_key, body, ttl=1500)  # 25 min — slightly under sync interval
            return body
        logger.warning("Skipping non-M3U response from %s", url)
    except Exception as exc:
        logger.warning("Could not fetch M3U source %s: %s", url, exc)
    return None


def fetch_all_sports_m3u(extra_urls: list[str] | None = None) -> list[str]:
    """Fetch all configured M3U sources; returns list of valid playlist texts."""
    sources: list[str] = []
    sources.extend(DEFAULT_M3U_SOURCES)
    sources.extend(INDIA_FULL_SOURCES)
    sources.extend(BANGLADESH_SOURCES)
    if settings.scraper_source_url and settings.scraper_source_url not in sources:
        sources.insert(0, settings.scraper_source_url)
    if extra_urls:
        for u in extra_urls:
            if u not in sources:
                sources.append(u)
    results: list[str] = []
    for url in sources:
        playlist = _fetch_m3u_safe(url)
        if playlist:
            results.append(playlist)
    return results


def _is_junk_channel_name(name: str) -> bool:
    s = (name or "").strip()
    if not s or len(s) < 2:
        return True
    if _JUNK_NAME_RE.match(s) or _KODIPROP_NAME_RE.match(s):
        return True
    if "#KODIPROP" in s.upper():
        return True
    return False


def _display_channel_name(name: str) -> str:
    cleaned = re.sub(r"#?KODIPROP:[^\s]*", " ", name, flags=re.IGNORECASE)
    cleaned = _CHAN_NORM_RE.sub(" ", cleaned)
    cleaned = _CHAN_SUFFIX_NORM_RE.sub(" ", cleaned)
    return " ".join(cleaned.split()).strip() or name.strip()


def _normalize_channel_name(name: str) -> str:
    """Strip quality/status tags to normalize channel names for mirror grouping.

    "ESPN (1080p)" and "ESPN (720p)" from two different sources will be treated
    as mirrors of the same channel, with the second URL stored as an alternate.
    """
    return _display_channel_name(name).lower().strip()


def _url_looks_hls(u: str) -> bool:
    try:
        p = urllib.parse.urlparse(u).path.lower()
        return p.endswith(".m3u8")
    except Exception:
        return False


def _is_valid_stream_url(url: str) -> bool:
    """Quick validation: URL must be HTTPS/HTTP and not too long."""
    if not url:
        return False
    s = url.strip().lower()
    if not (s.startswith("http://") or s.startswith("https://")):
        if not (s.startswith("rtmp") or s.startswith("rtp") or s.startswith("udp")):
            return False
    if len(s) > 2048:
        return False
    return True


def _prefer_hls_url_as_primary(
    primary: ParsedChannel, alternates: list[str]
) -> tuple[ParsedChannel, list[str]]:
    """
    If the same logical channel was merged with a DASH (``.mpd``) primary but an
    HLS mirror exists, serve HLS as stream_url and demote the rest. Browsers
    work best with HLS; DASH is still available when no HLS exists.
    """
    all_urls = [primary.stream_url, *alternates]
    hls = [u for u in all_urls if _url_looks_hls(u)]
    if not hls:
        return primary, alternates
    pick = hls[0]
    if pick == primary.stream_url:
        return primary, alternates
    rest = [u for u in all_urls if u != pick]
    return (
        ParsedChannel(
            name=primary.name,
            stream_url=pick,
            logo_url=primary.logo_url,
            category=primary.category,
            country=primary.country,
            language=primary.language,
            module=primary.module,
            geo_hint=primary.geo_hint,
        ),
        rest,
    )


def _group_entries_by_name(
    entries: list[ParsedChannel],
) -> list[tuple[ParsedChannel, list[str]]]:
    """
    Group entries by (module, normalized_name).
    Returns list of (primary_entry, [alternate_stream_urls]).

    Normalization strips quality/geo-block tags so that duplicate entries of the
    same channel (e.g. "ESPN (1080p)" and "ESPN (720p)" from different sources)
    are merged into one record with multiple backup stream URLs.
    """
    seen_urls: set[str] = set()
    groups: dict[str, tuple[ParsedChannel, list[str]]] = {}

    for entry in entries:
        if entry.stream_url in seen_urls:
            continue
        seen_urls.add(entry.stream_url)

        norm = f"{entry.module}::{_normalize_channel_name(entry.name)}"
        if norm not in groups:
            groups[norm] = (entry, [])
        else:
            groups[norm][0].geo_hint = groups[norm][0].geo_hint or entry.geo_hint
            groups[norm][1].append(entry.stream_url)

    return list(groups.values())


def sync_channels_from_entries(
    db: Session,
    entries: Iterable[ParsedChannel],
    source: str = "iptv-org",
) -> dict[str, int]:
    raw = list(entries)
    all_entries = _dedupe_entries_by_stream_url_priority(raw)
    if len(all_entries) < len(raw):
        logger.info("Stream URL dedupe: %d -> %d rows", len(raw), len(all_entries))
    grouped = [
        _prefer_hls_url_as_primary(primary, alts) for primary, alts in _group_entries_by_name(all_entries)
    ]

    created = 0
    updated = 0
    _now = datetime.now(tz=timezone.utc).replace(tzinfo=None)  # naive UTC for DB
    primary_urls = [primary.stream_url for primary, _alts in grouped]
    existing_by_url: dict[str, Channel] = {}
    for offset in range(0, len(primary_urls), 500):
        chunk = primary_urls[offset : offset + 500]
        if not chunk:
            continue
        existing_by_url.update(
            {
                channel.stream_url: channel
                for channel in db.scalars(select(Channel).where(Channel.stream_url.in_(chunk))).all()
            }
        )

    for primary, alts in grouped:
        # Filter out any alternate_urls that are already primary stream_urls in existing_by_url (prevent duplicates)
        clean_alts = [u for u in alts if u not in existing_by_url]
        alt_json = json.dumps(clean_alts) if clean_alts else None
        normalized_name = _display_channel_name(primary.name)[:255]
        channel = existing_by_url.get(primary.stream_url)

        auto_hp = _auto_header_profile(normalized_name, primary.stream_url)

        if channel is None:
            channel = Channel(
                name=normalized_name,
                stream_url=primary.stream_url,
                logo_url=primary.logo_url,
                category=primary.category,
                country=primary.country,
                language=primary.language,
                quality_tag="auto",
                source=source,
                module=primary.module,
                alternate_urls=alt_json,
                geo_hint=primary.geo_hint,
                header_profile=auto_hp,
                is_active=True,
            )
            db.add(channel)
            existing_by_url[primary.stream_url] = channel
            created += 1
        else:
            channel.name = normalized_name
            channel.logo_url = primary.logo_url
            channel.category = primary.category or channel.category
            channel.country = primary.country or channel.country
            channel.language = primary.language or channel.language
            channel.source = source
            channel.module = primary.module
            channel.geo_hint = bool(channel.geo_hint or primary.geo_hint)
            channel.alternate_urls = _merge_alternate_urls(
                channel.stream_url, channel.alternate_urls, clean_alts
            )
            # Auto-assign profile only when admin hasn't set one manually.
            if channel.header_profile is None and auto_hp:
                channel.header_profile = auto_hp
            channel.is_active = True
            channel.updated_at = _now
            updated += 1

    db.commit()
    logger.info(
        "Sync DB write complete created=%d updated=%d total=%d grouped=%d parsed=%d",
        created,
        updated,
        created + updated,
        len(grouped),
        len(all_entries),
    )
    return {"created": created, "updated": updated, "total": created + updated}


def _fetch_sources_parallel(
    url_flag_pairs: list[tuple[str, bool, str]],
    *,
    timeout_by_url: dict[str, float] | None = None,
    max_workers: int = 8,
) -> tuple[list[ParsedChannel], dict[str, int]]:
    """
    Fetch multiple M3U sources in parallel using a thread pool.

    url_flag_pairs: list of (url, sports_only, module)
    timeout_by_url: optional per-URL requests timeout (seconds), e.g. large index.m3u
    Returns combined list of ParsedChannel entries and fetch stats.
    """
    results: list[ParsedChannel] = []
    sources_ok = 0
    sources_failed = 0

    def _fetch_and_parse(url: str, sports_only: bool, module: str) -> tuple[list[ParsedChannel], bool]:
        to = timeout_by_url.get(url) if timeout_by_url else None
        playlist = _fetch_m3u_safe(url, timeout_seconds=to)
        if not playlist:
            return [], False
        entries = parse_m3u_entries(playlist, sports_only=sports_only, module=module)
        logger.info("Fetched %d entries from %s (sports_only=%s)", len(entries), url, sports_only)
        return entries, True

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(_fetch_and_parse, url, sports_only, module): url
            for url, sports_only, module in url_flag_pairs
        }
        for fut in as_completed(futures):
            url = futures[fut]
            try:
                entries, ok = fut.result()
                if ok:
                    sources_ok += 1
                    results.extend(entries)
                else:
                    sources_failed += 1
            except Exception as exc:
                sources_failed += 1
                logger.warning("Parallel fetch error for %s: %s", url, exc)

    return results, {"sources_ok": sources_ok, "sources_failed": sources_failed, "parsed": len(results)}


# Known EPG IDs mapped from normalized channel name fragments.
# Used by playlist.m3u endpoint to enrich EXTINF lines.
EPG_ID_MAP: dict[str, str] = {
    "sony sports 1": "sony_sports_1",
    "sony sports 2": "sony_sports_2",
    "sony ten 1": "sony_ten_1",
    "sony ten 2": "sony_ten_2",
    "sony ten 3": "sony_ten_3",
    "star sports 1": "star_sports_1",
    "star sports 2": "star_sports_2",
    "star sports hd1": "star_sports_1",
    "willow": "willow",
    "espn": "espn",
    "espn2": "espn2",
    "sky sports f1": "skysf1",
    "sky sports cricket": "skyscricket",
    "sky sports main event": "skymain",
    "beinsports 1": "beinsports1",
    "beinsports 2": "beinsports2",
    "eurosport 1": "eurosport1",
    "eurosport 2": "eurosport2",
    "fox sports": "foxsports",
    "ten cricket": "tencricket",
    "ptv sports": "ptvsports",
    "geo super": "geosuper",
    "channel 24": "channel24bd",
    "somoy tv": "somoytv",
    "jamuna tv": "jamunatv",
    "rtv": "rtv",
    "dd sports": "ddsports",
    "star cricket": "starcricket",
    "red bull tv": "redbulltv",
    "redbull tv": "redbulltv",
}

EPG_URL = "https://avkb.short.gy/epg.xml.gz"


def lookup_epg_id(channel_name: str) -> str | None:
    """Return EPG tvg-id for a known channel name, or None."""
    key = channel_name.lower().strip()
    if key in EPG_ID_MAP:
        return EPG_ID_MAP[key]
    for k, v in EPG_ID_MAP.items():
        if k in key:
            return v
    return None


def scrape_and_sync_sports_channels(
    db: Session,
    extra_urls: list[str] | None = None,
) -> dict[str, int]:
    """
    Fetch all M3U sources in parallel and sync to DB.

    - Category playlists (sports, football, …) → module=global_sports, no keyword filter
    - India sports M3U                           → module=india, all channels
    - Bangladesh regional M3U                    → module=bangladesh, all channels
    - Global FAST channels                       → module=fast_tv, 24/7 linear streams
    - extra_urls (discovery)                     → module=global_sports, sports_only=True

    Dedup by stream URL: first occurrence wins (sources ordered by maintenance quality).
    """
    category_urls = set(SPORTS_CATEGORY_SOURCES)

    # Build list of (url, sports_only, module) tuples for parallel fetch
    fetch_jobs: list[tuple[str, bool, str]] = []

    for url in DEFAULT_M3U_SOURCES:
        sports_only = url not in category_urls
        fetch_jobs.append((url, sports_only, GLOBAL_SPORTS_MODULE))

    for url in INDIA_FULL_SOURCES:
        fetch_jobs.append((url, False, "india"))

    for url in BANGLADESH_SOURCES:
        fetch_jobs.append((url, False, "bangladesh"))

    for url in GLOBAL_FAST_SOURCES:
        fetch_jobs.append((url, False, "fast_tv"))

    # Custom env URL
    all_seed_urls = set(DEFAULT_M3U_SOURCES) | set(INDIA_FULL_SOURCES) | set(BANGLADESH_SOURCES) | set(GLOBAL_FAST_SOURCES)
    if settings.scraper_source_url and settings.scraper_source_url not in all_seed_urls:
        fetch_jobs.append((settings.scraper_source_url, False, GLOBAL_SPORTS_MODULE))

    # Discovered sources from m3u_discovery (already deduplicated vs. main list)
    if extra_urls:
        known = {url for url, _, _ in fetch_jobs}
        for url in extra_urls:
            if url not in known:
                fetch_jobs.append((url, True, GLOBAL_SPORTS_MODULE))  # filter by sports keywords

    timeout_by_url: dict[str, float] = {}
    if settings.iptv_full_index_sync:
        idx = (settings.iptv_full_index_url or "").strip()
        if idx:
            known_urls = {url for url, _, _ in fetch_jobs}
            if idx not in known_urls:
                fetch_jobs.append((idx, False, GLOBAL_SPORTS_MODULE))
            timeout_by_url[idx] = float(settings.iptv_full_index_fetch_timeout_seconds)

    logger.info("Sync start source_count=%d", len(fetch_jobs))
    all_entries, fetch_stats = _fetch_sources_parallel(
        fetch_jobs, timeout_by_url=timeout_by_url or None, max_workers=4
    )

    if not all_entries:
        logger.warning("Sync skipped reason=no_channels_parsed source_count=%d", len(fetch_jobs))
        return {
            "created": 0,
            "updated": 0,
            "total": 0,
            "parsed": 0,
            **fetch_stats,
        }

    logger.info(
        "Sync parsed entry_count=%d source_count=%d sources_ok=%d sources_failed=%d",
        len(all_entries),
        len(fetch_jobs),
        fetch_stats.get("sources_ok", 0),
        fetch_stats.get("sources_failed", 0),
    )
    db_result = sync_channels_from_entries(db, all_entries)
    db_result["parsed"] = len(all_entries)
    db_result.update(fetch_stats)
    return db_result
