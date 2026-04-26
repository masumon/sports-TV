from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from collections.abc import Iterable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.channel import Channel

logger = logging.getLogger("app.scraper")

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

REQUEST_TIMEOUT_SECONDS = 8
FETCH_RETRY_DELAYS_SECONDS = (1, 2, 4, 8)
MAX_FETCH_ATTEMPTS = 5

# ─────────────────────────────────────────────────────────────────────────────
# M3U Source Definitions
# ─────────────────────────────────────────────────────────────────────────────

# Sports category playlists — already sports-specific, no keyword filtering needed
SPORTS_CATEGORY_SOURCES: list[str] = [
    "https://iptv-org.github.io/iptv/categories/sports.m3u",
    "https://iptv-org.github.io/iptv/categories/football.m3u",
    "https://iptv-org.github.io/iptv/categories/cricket.m3u",
    "https://iptv-org.github.io/iptv/categories/basketball.m3u",
    "https://iptv-org.github.io/iptv/categories/tennis.m3u",
    "https://iptv-org.github.io/iptv/categories/baseball.m3u",
    "https://iptv-org.github.io/iptv/categories/hockey.m3u",
    "https://iptv-org.github.io/iptv/categories/boxing.m3u",
    "https://iptv-org.github.io/iptv/categories/motor-racing.m3u",
    "https://iptv-org.github.io/iptv/categories/golf.m3u",
    "https://iptv-org.github.io/iptv/categories/volleyball.m3u",
    "https://iptv-org.github.io/iptv/categories/wrestling.m3u",
]

# India — full iptv-org country list (all genres; module=india for UI)
INDIA_FULL_SOURCES: list[str] = [
    "https://iptv-org.github.io/iptv/countries/in.m3u",
]

# Bangladesh — full country list (all genres; module=bangladesh)
BANGLADESH_SOURCES: list[str] = [
    "https://iptv-org.github.io/iptv/countries/bd.m3u",
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

# If the same stream_url appears in multiple jobs, keep the highest-priority module
# (regional full-lineup lists win over the global sports pool).
_MODULE_URL_PRIORITY: dict[str, int] = {"bangladesh": 3, "india": 2, "sports": 1}


def _dedupe_entries_by_stream_url_priority(entries: list[ParsedChannel]) -> list[ParsedChannel]:
    pri = _MODULE_URL_PRIORITY
    by_url: dict[str, ParsedChannel] = {}
    for e in entries:
        p = pri.get(e.module, 0)
        ex = by_url.get(e.stream_url)
        if ex is None or p > pri.get(ex.module, 0):
            by_url[e.stream_url] = e
    return list(by_url.values())


@dataclass(slots=True)
class ParsedChannel:
    name: str
    stream_url: str
    logo_url: str | None
    category: str
    country: str
    language: str
    module: str = "sports"


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
    module: str = "sports",
) -> list[ParsedChannel]:
    lines = [line.strip() for line in playlist_text.splitlines() if line.strip()]
    entries: list[ParsedChannel] = []

    for index, line in enumerate(lines):
        if not line.startswith("#EXTINF"):
            continue
        if index + 1 >= len(lines):
            continue

        stream_url = lines[index + 1].strip()
        if not stream_url or stream_url.startswith("#"):
            continue

        name = line.split(",", 1)[1].strip() if "," in line else "Unknown Channel"
        default_cat = "Sports" if module == "sports" else "General"
        category = (_extract_attr(line, "group-title") or default_cat)[:120]

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
            )
        )

    return entries


def _get_with_retry(url: str) -> requests.Response:
    last_exc: Exception | None = None
    for attempt in range(1, MAX_FETCH_ATTEMPTS + 1):
        try:
            response = requests.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
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
    response = _get_with_retry(source_url)
    body = response.text
    if not body.strip().startswith("#EXTM3U"):
        raise ValueError("Invalid M3U source received.")
    return body


def _fetch_m3u_safe(url: str) -> str | None:
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
        response = _get_with_retry(url)
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


def _display_channel_name(name: str) -> str:
    cleaned = _CHAN_NORM_RE.sub(" ", name)
    return " ".join(cleaned.split()).strip() or name.strip()


def _normalize_channel_name(name: str) -> str:
    """Strip quality/status tags to normalize channel names for mirror grouping.

    "ESPN (1080p)" and "ESPN (720p)" from two different sources will be treated
    as mirrors of the same channel, with the second URL stored as an alternate.
    """
    return _display_channel_name(name).lower().strip()


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
            groups[norm][1].append(entry.stream_url)

    return list(groups.values())


def sync_channels_from_entries(db: Session, entries: Iterable[ParsedChannel]) -> dict[str, int]:
    raw = list(entries)
    all_entries = _dedupe_entries_by_stream_url_priority(raw)
    if len(all_entries) < len(raw):
        logger.info("Stream URL dedupe: %d -> %d rows", len(raw), len(all_entries))
    grouped = _group_entries_by_name(all_entries)

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
        alt_json = json.dumps(alts) if alts else None
        normalized_name = _display_channel_name(primary.name)[:255]
        channel = existing_by_url.get(primary.stream_url)

        if channel is None:
            channel = Channel(
                name=normalized_name,
                stream_url=primary.stream_url,
                logo_url=primary.logo_url,
                category=primary.category,
                country=primary.country,
                language=primary.language,
                quality_tag="auto",
                source="iptv-org",
                module=primary.module,
                alternate_urls=alt_json,
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
            channel.source = "iptv-org"
            channel.module = primary.module
            channel.alternate_urls = alt_json
            channel.is_active = True
            # Explicitly bump updated_at so the cleanup engine can detect stale channels.
            # (onupdate fires only if SQLAlchemy detects a dirty column; this guarantees it.)
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
    max_workers: int = 8,
) -> list[ParsedChannel]:
    """
    Fetch multiple M3U sources in parallel using a thread pool.

    url_flag_pairs: list of (url, sports_only, module)
    Returns combined list of ParsedChannel entries.
    """
    results: list[ParsedChannel] = []

    def _fetch_and_parse(url: str, sports_only: bool, module: str) -> list[ParsedChannel]:
        playlist = _fetch_m3u_safe(url)
        if not playlist:
            return []
        entries = parse_m3u_entries(playlist, sports_only=sports_only, module=module)
        logger.info("Fetched %d entries from %s (sports_only=%s)", len(entries), url, sports_only)
        return entries

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(_fetch_and_parse, url, sports_only, module): url
            for url, sports_only, module in url_flag_pairs
        }
        for fut in as_completed(futures):
            url = futures[fut]
            try:
                entries = fut.result()
                results.extend(entries)
            except Exception as exc:
                logger.warning("Parallel fetch error for %s: %s", url, exc)

    return results


def scrape_and_sync_sports_channels(
    db: Session,
    extra_urls: list[str] | None = None,
) -> dict[str, int]:
    """
    Fetch all M3U sources in parallel and sync to DB.

    - Category playlists (sports, football, …) → module=sports, no keyword filter
    - India full country M3U                      → module=india, all channels
    - Bangladesh full country M3U                 → module=bangladesh, all channels
    - extra_urls (discovery)                        → module=sports, sports_only=True

    Same stream_url in multiple jobs is resolved: bangladesh > india > sports.
    """
    category_urls = set(SPORTS_CATEGORY_SOURCES)

    # Build list of (url, sports_only, module) tuples for parallel fetch
    fetch_jobs: list[tuple[str, bool, str]] = []

    for url in DEFAULT_M3U_SOURCES:
        sports_only = url not in category_urls
        fetch_jobs.append((url, sports_only, "sports"))

    for url in INDIA_FULL_SOURCES:
        fetch_jobs.append((url, False, "india"))

    for url in BANGLADESH_SOURCES:
        fetch_jobs.append((url, False, "bangladesh"))

    # Custom env URL
    all_seed_urls = set(DEFAULT_M3U_SOURCES) | set(INDIA_FULL_SOURCES) | set(BANGLADESH_SOURCES)
    if settings.scraper_source_url and settings.scraper_source_url not in all_seed_urls:
        fetch_jobs.append((settings.scraper_source_url, False, "sports"))

    # Discovered sources from m3u_discovery (already deduplicated vs. main list)
    if extra_urls:
        known = {url for url, _, _ in fetch_jobs}
        for url in extra_urls:
            if url not in known:
                fetch_jobs.append((url, True, "sports"))  # filter by sports keywords

    logger.info("Sync start source_count=%d", len(fetch_jobs))
    all_entries = _fetch_sources_parallel(fetch_jobs, max_workers=8)

    if not all_entries:
        logger.warning("Sync skipped reason=no_channels_parsed source_count=%d", len(fetch_jobs))
        return {"created": 0, "updated": 0, "total": 0}

    logger.info(
        "Sync parsed entry_count=%d source_count=%d",
        len(all_entries),
        len(fetch_jobs),
    )
    return sync_channels_from_entries(db, all_entries)
