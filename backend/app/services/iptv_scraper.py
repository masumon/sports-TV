from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import dataclass

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.channel import Channel

logger = logging.getLogger("app.scraper")

# Primary + supplementary M3U sources (deduplicated by stream_url at sync time).
# iptv-org: open sports/category playlists — covers 200+ countries
DEFAULT_M3U_SOURCES: list[str] = [
    # ── Category playlists (iptv-org) ─────────────────────────────────────────
    "https://iptv-org.github.io/iptv/categories/sports.m3u",
    "https://iptv-org.github.io/iptv/categories/football.m3u",
    "https://iptv-org.github.io/iptv/categories/cricket.m3u",
    "https://iptv-org.github.io/iptv/categories/basketball.m3u",
    "https://iptv-org.github.io/iptv/categories/tennis.m3u",
    "https://iptv-org.github.io/iptv/categories/baseball.m3u",
    # ── Country sports channels (iptv-org) ────────────────────────────────────
    "https://iptv-org.github.io/iptv/countries/gb.m3u",   # UK
    "https://iptv-org.github.io/iptv/countries/us.m3u",   # USA
    "https://iptv-org.github.io/iptv/countries/in.m3u",   # India
    "https://iptv-org.github.io/iptv/countries/bd.m3u",   # Bangladesh
    "https://iptv-org.github.io/iptv/countries/pk.m3u",   # Pakistan
    "https://iptv-org.github.io/iptv/countries/au.m3u",   # Australia
    "https://iptv-org.github.io/iptv/countries/es.m3u",   # Spain
    "https://iptv-org.github.io/iptv/countries/de.m3u",   # Germany
    "https://iptv-org.github.io/iptv/countries/fr.m3u",   # France
    "https://iptv-org.github.io/iptv/countries/it.m3u",   # Italy
    "https://iptv-org.github.io/iptv/countries/br.m3u",   # Brazil
    "https://iptv-org.github.io/iptv/countries/ar.m3u",   # Argentina
    "https://iptv-org.github.io/iptv/countries/sa.m3u",   # Saudi Arabia
    "https://iptv-org.github.io/iptv/countries/ae.m3u",   # UAE
    "https://iptv-org.github.io/iptv/countries/tr.m3u",   # Turkey
    "https://iptv-org.github.io/iptv/countries/nl.m3u",   # Netherlands
    "https://iptv-org.github.io/iptv/countries/pt.m3u",   # Portugal
    "https://iptv-org.github.io/iptv/countries/mx.m3u",   # Mexico
    "https://iptv-org.github.io/iptv/countries/za.m3u",   # South Africa
    "https://iptv-org.github.io/iptv/countries/ng.m3u",   # Nigeria
    "https://iptv-org.github.io/iptv/countries/jp.m3u",   # Japan
    "https://iptv-org.github.io/iptv/countries/kr.m3u",   # South Korea
    "https://iptv-org.github.io/iptv/countries/ru.m3u",   # Russia
    "https://iptv-org.github.io/iptv/countries/pl.m3u",   # Poland
    "https://iptv-org.github.io/iptv/countries/ro.m3u",   # Romania
    "https://iptv-org.github.io/iptv/countries/gr.m3u",   # Greece
]
SPORTS_M3U_URL = DEFAULT_M3U_SOURCES[0]
REQUEST_TIMEOUT_SECONDS = 20

# Category keywords to consider a channel "sports-related"
# (used when fetching country playlists that mix all categories)
SPORTS_KEYWORDS = {
    "sport", "football", "soccer", "cricket", "basketball", "tennis", "rugby",
    "hockey", "golf", "boxing", "ufc", "mma", "formula", "f1", "racing",
    "cycling", "athletics", "swimming", "volleyball", "badminton", "snooker",
    "darts", "wrestling", "wrestling", "esports", "olympic", "games",
}


@dataclass(slots=True)
class ParsedChannel:
    name: str
    stream_url: str
    logo_url: str | None
    category: str
    country: str
    language: str


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


def parse_m3u_entries(playlist_text: str, sports_only: bool = False) -> list[ParsedChannel]:
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

        name = line.split(",", 1)[1].strip() if "," in line else "Unknown Sports Channel"
        category = (_extract_attr(line, "group-title") or "Sports")[:120]

        # When fetching broad country playlists, skip non-sports channels
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
            )
        )

    return entries


def fetch_sports_m3u(url: str | None = None) -> str:
    source_url = url or settings.scraper_source_url or SPORTS_M3U_URL
    response = requests.get(source_url, timeout=REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()
    body = response.text
    if not body.strip().startswith("#EXTM3U"):
        raise ValueError("Invalid M3U source received.")
    return body


def _fetch_m3u_safe(url: str) -> str | None:
    """Fetch a single M3U source; return None on any error (don't abort the whole sync)."""
    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
        response.raise_for_status()
        body = response.text
        if body.strip().startswith("#EXTM3U"):
            return body
        logger.warning("Skipping non-M3U response from %s", url)
    except Exception as exc:
        logger.warning("Could not fetch M3U source %s: %s", url, exc)
    return None


def fetch_all_sports_m3u(extra_urls: list[str] | None = None) -> list[str]:
    """Fetch all configured M3U sources; returns list of valid playlist texts."""
    sources = list(DEFAULT_M3U_SOURCES)
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


def sync_channels_from_entries(db: Session, entries: Iterable[ParsedChannel]) -> dict[str, int]:
    created = 0
    updated = 0
    seen_urls: set[str] = set()

    for entry in entries:
        # Skip within-batch duplicates (multiple sources may list same stream)
        if entry.stream_url in seen_urls:
            continue
        seen_urls.add(entry.stream_url)

        channel = db.scalar(select(Channel).where(Channel.stream_url == entry.stream_url))
        if channel is None:
            channel = Channel(
                name=entry.name,
                stream_url=entry.stream_url,
                logo_url=entry.logo_url,
                category=entry.category,
                country=entry.country,
                language=entry.language,
                quality_tag="auto",
                source="iptv-org",
                is_active=True,
            )
            db.add(channel)
            created += 1
        else:
            channel.name = entry.name
            channel.logo_url = entry.logo_url
            channel.category = entry.category or channel.category
            channel.country = entry.country or channel.country
            channel.language = entry.language or channel.language
            channel.source = "iptv-org"
            channel.is_active = True
            updated += 1

    db.commit()
    return {"created": created, "updated": updated, "total": created + updated}


def scrape_and_sync_sports_channels(db: Session) -> dict[str, int]:
    # Category-specific playlists are already sports-only; country playlists need filtering
    category_urls = {u for u in DEFAULT_M3U_SOURCES if "/categories/" in u}
    country_urls = {u for u in DEFAULT_M3U_SOURCES if "/countries/" in u}

    all_entries: list[ParsedChannel] = []
    sources_fetched = 0

    for url in DEFAULT_M3U_SOURCES:
        playlist = _fetch_m3u_safe(url)
        if not playlist:
            continue
        sports_only = url in country_urls
        entries = parse_m3u_entries(playlist, sports_only=sports_only)
        all_entries.extend(entries)
        sources_fetched += 1

    # Also include custom scraper_source_url if set
    if settings.scraper_source_url and settings.scraper_source_url not in DEFAULT_M3U_SOURCES:
        playlist = _fetch_m3u_safe(settings.scraper_source_url)
        if playlist:
            all_entries.extend(parse_m3u_entries(playlist, sports_only=False))
            sources_fetched += 1

    if not all_entries:
        raise ValueError("No channels parsed from any M3U source.")
    logger.info("Parsed %d total entries from %d source(s)", len(all_entries), sources_fetched)
    return sync_channels_from_entries(db, all_entries)
