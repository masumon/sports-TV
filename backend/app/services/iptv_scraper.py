from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.channel import Channel

SPORTS_M3U_URL = "https://iptv-org.github.io/iptv/categories/sports.m3u"
REQUEST_TIMEOUT_SECONDS = 20


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


def parse_m3u_entries(playlist_text: str) -> list[ParsedChannel]:
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
        entries.append(
            ParsedChannel(
                name=name[:255],
                stream_url=stream_url[:2048],
                logo_url=(_extract_attr(line, "tvg-logo") or "")[:1024] or None,
                category=(_extract_attr(line, "group-title") or "Sports")[:120],
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


def sync_channels_from_entries(db: Session, entries: Iterable[ParsedChannel]) -> dict[str, int]:
    created = 0
    updated = 0

    for entry in entries:
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
    playlist = fetch_sports_m3u()
    entries = parse_m3u_entries(playlist)
    if not entries:
        raise ValueError("No channels parsed from sports M3U.")
    return sync_channels_from_entries(db, entries)
