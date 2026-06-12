"""M3U8 Playlist parser - extract channels from M3U8 files."""

import re
from typing import Optional
from dataclasses import dataclass
from urllib.parse import urljoin


@dataclass
class M3U8Channel:
    """Parsed M3U8 channel entry."""
    name: str
    url: str
    logo_url: Optional[str] = None
    group_title: Optional[str] = None
    tvg_name: Optional[str] = None
    tvg_id: Optional[str] = None
    country: str = "Global"
    language: str = "Unknown"
    quality_tag: str = "auto"


def parse_m3u8(content: str, base_url: Optional[str] = None) -> list[M3U8Channel]:
    """
    Parse M3U8 playlist content and extract channels.

    Args:
        content: M3U8 file content (string)
        base_url: Optional base URL for resolving relative URLs

    Returns:
        List of M3U8Channel objects
    """
    channels = []
    lines = content.strip().split('\n')

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        i += 1

        # Look for EXTINF lines (channel metadata)
        if line.startswith('#EXTINF:'):
            extinf = line

            # Next line should be the URL
            if i < len(lines):
                url = lines[i].strip()
                i += 1

                if url and not url.startswith('#'):
                    # Resolve relative URLs
                    if base_url and not url.startswith('http'):
                        url = urljoin(base_url, url)

                    # Parse EXTINF attributes
                    channel = _parse_extinf(extinf, url)
                    channels.append(channel)

    return channels


def _parse_extinf(extinf_line: str, url: str) -> M3U8Channel:
    """Parse a single EXTINF line."""
    # Example: #EXTINF:-1 tvg-id="..." tvg-name="..." group-title="..." tvg-logo="...",Channel Name

    # Extract attributes
    attrs = {}

    # tvg-name
    match = re.search(r'tvg-name="([^"]*)"', extinf_line)
    if match:
        attrs['tvg_name'] = match.group(1)

    # tvg-id
    match = re.search(r'tvg-id="([^"]*)"', extinf_line)
    if match:
        attrs['tvg_id'] = match.group(1)

    # group-title
    match = re.search(r'group-title="([^"]*)"', extinf_line)
    if match:
        attrs['group_title'] = match.group(1)

    # tvg-logo
    match = re.search(r'tvg-logo="([^"]*)"', extinf_line)
    if match:
        attrs['logo_url'] = match.group(1)

    # Channel name (after comma)
    parts = extinf_line.split(',', 1)
    name = parts[1].strip() if len(parts) > 1 else "Unknown Channel"

    # Infer country/language from group_title or name
    country = _infer_country(attrs.get('group_title', name))
    language = _infer_language(attrs.get('group_title', name))

    return M3U8Channel(
        name=name,
        url=url,
        logo_url=attrs.get('logo_url'),
        group_title=attrs.get('group_title'),
        tvg_name=attrs.get('tvg_name'),
        tvg_id=attrs.get('tvg_id'),
        country=country,
        language=language,
        quality_tag="auto"
    )


def _infer_country(text: str) -> str:
    """Infer country from text."""
    text_lower = text.lower()

    countries = {
        'bangladesh': 'Bangladesh',
        'বাংলাদেশ': 'Bangladesh',
        'india': 'India',
        'ভারত': 'India',
        'pakistan': 'Pakistan',
        'পাকিস্তান': 'Pakistan',
        'usa': 'USA',
        'uk': 'United Kingdom',
        'canada': 'Canada',
        'australia': 'Australia',
    }

    for key, val in countries.items():
        if key in text_lower:
            return val

    return 'Global'


def _infer_language(text: str) -> str:
    """Infer language from text."""
    text_lower = text.lower()

    languages = {
        'bangla': 'Bengali',
        'বাংলা': 'Bengali',
        'bengali': 'Bengali',
        'english': 'English',
        'hindi': 'Hindi',
        'হিন্দি': 'Hindi',
        'urdu': 'Urdu',
        'punjabi': 'Punjabi',
        'tamil': 'Tamil',
        'telugu': 'Telugu',
    }

    for key, val in languages.items():
        if key in text_lower:
            return val

    return 'Unknown'


def validate_m3u8(content: str) -> bool:
    """Check if content looks like valid M3U8."""
    return content.strip().startswith('#EXTM3U')
