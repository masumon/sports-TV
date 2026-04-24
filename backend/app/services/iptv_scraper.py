from __future__ import annotations

import json
import logging
from collections.abc import Iterable
from dataclasses import dataclass, field

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.channel import Channel

logger = logging.getLogger("app.scraper")

REQUEST_TIMEOUT_SECONDS = 25

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

# Country playlists — mixed channels; filtered by sports keywords
SPORTS_COUNTRY_SOURCES: list[str] = [
    # Asia
    "https://iptv-org.github.io/iptv/countries/in.m3u",
    "https://iptv-org.github.io/iptv/countries/pk.m3u",
    "https://iptv-org.github.io/iptv/countries/lk.m3u",
    "https://iptv-org.github.io/iptv/countries/my.m3u",
    "https://iptv-org.github.io/iptv/countries/sg.m3u",
    "https://iptv-org.github.io/iptv/countries/th.m3u",
    "https://iptv-org.github.io/iptv/countries/id.m3u",
    "https://iptv-org.github.io/iptv/countries/ph.m3u",
    "https://iptv-org.github.io/iptv/countries/vn.m3u",
    "https://iptv-org.github.io/iptv/countries/cn.m3u",
    "https://iptv-org.github.io/iptv/countries/jp.m3u",
    "https://iptv-org.github.io/iptv/countries/kr.m3u",
    "https://iptv-org.github.io/iptv/countries/np.m3u",
    "https://iptv-org.github.io/iptv/countries/af.m3u",
    # Middle East
    "https://iptv-org.github.io/iptv/countries/sa.m3u",
    "https://iptv-org.github.io/iptv/countries/ae.m3u",
    "https://iptv-org.github.io/iptv/countries/tr.m3u",
    "https://iptv-org.github.io/iptv/countries/qa.m3u",
    "https://iptv-org.github.io/iptv/countries/kw.m3u",
    "https://iptv-org.github.io/iptv/countries/ir.m3u",
    "https://iptv-org.github.io/iptv/countries/iq.m3u",
    "https://iptv-org.github.io/iptv/countries/jo.m3u",
    # Europe
    "https://iptv-org.github.io/iptv/countries/gb.m3u",
    "https://iptv-org.github.io/iptv/countries/es.m3u",
    "https://iptv-org.github.io/iptv/countries/de.m3u",
    "https://iptv-org.github.io/iptv/countries/fr.m3u",
    "https://iptv-org.github.io/iptv/countries/it.m3u",
    "https://iptv-org.github.io/iptv/countries/nl.m3u",
    "https://iptv-org.github.io/iptv/countries/pt.m3u",
    "https://iptv-org.github.io/iptv/countries/ru.m3u",
    "https://iptv-org.github.io/iptv/countries/pl.m3u",
    "https://iptv-org.github.io/iptv/countries/ro.m3u",
    "https://iptv-org.github.io/iptv/countries/gr.m3u",
    "https://iptv-org.github.io/iptv/countries/at.m3u",
    "https://iptv-org.github.io/iptv/countries/be.m3u",
    "https://iptv-org.github.io/iptv/countries/ch.m3u",
    "https://iptv-org.github.io/iptv/countries/cz.m3u",
    "https://iptv-org.github.io/iptv/countries/dk.m3u",
    "https://iptv-org.github.io/iptv/countries/fi.m3u",
    "https://iptv-org.github.io/iptv/countries/hu.m3u",
    "https://iptv-org.github.io/iptv/countries/ie.m3u",
    "https://iptv-org.github.io/iptv/countries/no.m3u",
    "https://iptv-org.github.io/iptv/countries/se.m3u",
    "https://iptv-org.github.io/iptv/countries/hr.m3u",
    "https://iptv-org.github.io/iptv/countries/rs.m3u",
    "https://iptv-org.github.io/iptv/countries/ua.m3u",
    # Americas
    "https://iptv-org.github.io/iptv/countries/us.m3u",
    "https://iptv-org.github.io/iptv/countries/ca.m3u",
    "https://iptv-org.github.io/iptv/countries/br.m3u",
    "https://iptv-org.github.io/iptv/countries/ar.m3u",
    "https://iptv-org.github.io/iptv/countries/mx.m3u",
    "https://iptv-org.github.io/iptv/countries/cl.m3u",
    "https://iptv-org.github.io/iptv/countries/co.m3u",
    "https://iptv-org.github.io/iptv/countries/pe.m3u",
    "https://iptv-org.github.io/iptv/countries/uy.m3u",
    "https://iptv-org.github.io/iptv/countries/ec.m3u",
    "https://iptv-org.github.io/iptv/countries/ve.m3u",
    # Africa
    "https://iptv-org.github.io/iptv/countries/za.m3u",
    "https://iptv-org.github.io/iptv/countries/ng.m3u",
    "https://iptv-org.github.io/iptv/countries/gh.m3u",
    "https://iptv-org.github.io/iptv/countries/ke.m3u",
    "https://iptv-org.github.io/iptv/countries/eg.m3u",
    "https://iptv-org.github.io/iptv/countries/ma.m3u",
    "https://iptv-org.github.io/iptv/countries/tn.m3u",
    "https://iptv-org.github.io/iptv/countries/dz.m3u",
    "https://iptv-org.github.io/iptv/countries/et.m3u",
    "https://iptv-org.github.io/iptv/countries/cm.m3u",
    # Oceania
    "https://iptv-org.github.io/iptv/countries/au.m3u",
    "https://iptv-org.github.io/iptv/countries/nz.m3u",
]

# Bangladesh — ALL channels (news, entertainment, sports, drama, etc.)
BANGLADESH_SOURCES: list[str] = [
    "https://iptv-org.github.io/iptv/countries/bd.m3u",
]

# Combined sports sources for backward compat
DEFAULT_M3U_SOURCES: list[str] = SPORTS_CATEGORY_SOURCES + SPORTS_COUNTRY_SOURCES
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


def _group_entries_by_name(
    entries: list[ParsedChannel],
) -> list[tuple[ParsedChannel, list[str]]]:
    """
    Group entries by (module, normalized_name).
    Returns list of (primary_entry, [alternate_stream_urls]).
    """
    seen_urls: set[str] = set()
    groups: dict[str, tuple[ParsedChannel, list[str]]] = {}

    for entry in entries:
        if entry.stream_url in seen_urls:
            continue
        seen_urls.add(entry.stream_url)

        norm = f"{entry.module}::{entry.name.lower().strip()}"
        if norm not in groups:
            groups[norm] = (entry, [])
        else:
            groups[norm][1].append(entry.stream_url)

    return list(groups.values())


def sync_channels_from_entries(db: Session, entries: Iterable[ParsedChannel]) -> dict[str, int]:
    all_entries = list(entries)
    grouped = _group_entries_by_name(all_entries)

    created = 0
    updated = 0

    for primary, alts in grouped:
        alt_json = json.dumps(alts) if alts else None

        channel = db.scalar(select(Channel).where(Channel.stream_url == primary.stream_url))

        if channel is None:
            channel = Channel(
                name=primary.name,
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
            created += 1
        else:
            channel.name = primary.name
            channel.logo_url = primary.logo_url
            channel.category = primary.category or channel.category
            channel.country = primary.country or channel.country
            channel.language = primary.language or channel.language
            channel.source = "iptv-org"
            channel.module = primary.module
            channel.alternate_urls = alt_json
            channel.is_active = True
            updated += 1

    db.commit()
    return {"created": created, "updated": updated, "total": created + updated}


def scrape_and_sync_sports_channels(db: Session) -> dict[str, int]:
    """
    Fetch all M3U sources and sync to DB:
    - Category playlists: module=sports, no keyword filter
    - Country playlists: module=sports, sports_only=True
    - Bangladesh sources: module=bangladesh, no keyword filter (all channel types)
    """
    all_entries: list[ParsedChannel] = []
    sources_fetched = 0
    category_urls = set(SPORTS_CATEGORY_SOURCES)

    # Sports sources
    for url in DEFAULT_M3U_SOURCES:
        playlist = _fetch_m3u_safe(url)
        if not playlist:
            continue
        sports_only = url not in category_urls
        entries = parse_m3u_entries(playlist, sports_only=sports_only, module="sports")
        all_entries.extend(entries)
        sources_fetched += 1
        logger.info("Fetched %d sports entries from %s", len(entries), url)

    # Bangladesh all-channel sources
    for url in BANGLADESH_SOURCES:
        playlist = _fetch_m3u_safe(url)
        if not playlist:
            continue
        entries = parse_m3u_entries(playlist, sports_only=False, module="bangladesh")
        all_entries.extend(entries)
        sources_fetched += 1
        logger.info("Fetched %d Bangladesh entries from %s", len(entries), url)

    # Custom scraper_source_url from env
    if settings.scraper_source_url and settings.scraper_source_url not in DEFAULT_M3U_SOURCES:
        playlist = _fetch_m3u_safe(settings.scraper_source_url)
        if playlist:
            all_entries.extend(parse_m3u_entries(playlist, sports_only=False, module="sports"))
            sources_fetched += 1

    if not all_entries:
        raise ValueError("No channels parsed from any M3U source.")

    logger.info(
        "Total: %d entries from %d source(s) — syncing to DB",
        len(all_entries),
        sources_fetched,
    )
    return sync_channels_from_entries(db, all_entries)
