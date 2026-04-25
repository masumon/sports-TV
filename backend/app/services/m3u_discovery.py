"""
M3U Source Auto-Discovery Module  (Phase 3)

Discovers additional M3U sources beyond the static iptv-org list.
No LLM, no API keys — pure Python HTTP discovery.
Crawls known IPTV indexes and validates discovered URLs.
Results are cached to /tmp for 6 hours.
"""
from __future__ import annotations

import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

logger = logging.getLogger("app.discovery")

# ─── Timeouts ────────────────────────────────────────────────────────────────
_VALIDATE_TIMEOUT = 8   # seconds per URL
_CRAWL_TIMEOUT = 15     # seconds per crawl page

# ─── Disk cache (ephemeral on Render; rebuilt every 6h automatically) ─────────
_CACHE_FILE = Path("/tmp/gstv_discovered_sources.json")

# ─── How often to re-discover (seconds) ─────────────────────────────────────
_REDISCOVER_INTERVAL = 6 * 3600  # 6 hours

# ─────────────────────────────────────────────────────────────────────────────
# Static extra seed sources beyond the iptv-org categories/countries already
# in iptv_scraper.py.  All are publicly accessible, free, no auth required.
# ─────────────────────────────────────────────────────────────────────────────
_EXTRA_SPORTS_SEEDS: list[str] = [
    # Free-TV community playlist
    "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
    # iptv-org streams (direct stream files, not aggregated)
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/int.m3u",
    # Sports-specific GitHub playlists
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/categories/sports.m3u",
    # BeIN / sports aggregator mirrors
    "https://raw.githubusercontent.com/byte-capsule/Toffee-Channels-Link-Headers/main/toffee_OTT_Navigator.m3u",
    # Global sports public list
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/gb.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/in.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/pk.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/bd.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/sa.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ae.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/tr.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/br.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ar.m3u",
    # Additional aggregator lists known to work
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/de.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fr.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/es.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/it.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ru.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/za.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ng.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/eg.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/au.m3u",
    "https://raw.githubusercontent.com/iptv-org/iptv/master/streams/mx.m3u",
]

# ─── Pages to crawl for embedded M3U URLs ────────────────────────────────────
_CRAWL_PAGES: list[str] = [
    # awesome-iptv community list (Markdown — contains many raw M3U links)
    "https://raw.githubusercontent.com/iptv-org/awesome-iptv/master/README.md",
    # iptv-org website index
    "https://iptv-org.github.io/iptv/",
]

# ─── Regex patterns ───────────────────────────────────────────────────────────
# Extract raw M3U/M3U8 URLs from arbitrary text
_M3U_URL_RE = re.compile(
    r"https?://[^\s\"'<>\]\)]+\.m3u(?:8)?(?:[?#][^\s\"'<>\]\)]*)?",
    re.IGNORECASE,
)

# Keep only URLs that look sports-related
_SPORTS_URL_RE = re.compile(
    r"sport|football|soccer|cricket|basketball|tennis|hockey|boxing|"
    r"golf|ufc|mma|racing|formula|motor|nfl|nba|nhl|mlb|ipl|psl|bpl|"
    r"eurosport|beinsport|espn|skysport|supersport|willow|setanta|dazn|"
    r"bein|eleven|fox.sport|sky.sport|star.sport",
    re.IGNORECASE,
)

# ─── In-memory state ─────────────────────────────────────────────────────────
_discovered: list[str] = []
_last_run_at: float = 0.0


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _load_cache() -> list[str]:
    try:
        if _CACHE_FILE.exists():
            data = json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return [str(u) for u in data]
    except Exception:
        pass
    return []


def _save_cache(sources: list[str]) -> None:
    try:
        _CACHE_FILE.write_text(json.dumps(sources), encoding="utf-8")
    except Exception as exc:
        logger.debug("Discovery: could not write cache: %s", exc)


def _is_valid_m3u(url: str) -> bool:
    """Return True if the URL responds with M3U content."""
    try:
        resp = requests.get(url, timeout=_VALIDATE_TIMEOUT, stream=True)
        if resp.status_code != 200:
            return False
        chunk = b""
        for block in resp.iter_content(512):
            chunk += block
            if len(chunk) >= 512:
                break
        resp.close()
        text = chunk.decode("utf-8", errors="ignore")
        return "#EXTM3U" in text or "#EXTINF" in text
    except Exception:
        return False


def _crawl_m3u_urls_from_page(page_url: str) -> list[str]:
    """Fetch a page and extract sports M3U URLs from its content."""
    try:
        resp = requests.get(page_url, timeout=_CRAWL_TIMEOUT)
        if resp.status_code != 200:
            return []
        found = _M3U_URL_RE.findall(resp.text)
        sports = [u for u in found if _SPORTS_URL_RE.search(u)]
        return list(dict.fromkeys(sports))   # dedup, preserve order
    except Exception as exc:
        logger.debug("Discovery: crawl failed for %s — %s", page_url, exc)
        return []


# ─── Public API ───────────────────────────────────────────────────────────────

def discover_new_sources(force: bool = False) -> list[str]:
    """
    Discover and validate additional M3U sources.

    Strategy:
    1. Load previously validated sources from disk cache
    2. Add static seed URLs
    3. Crawl index pages for more URL candidates
    4. Validate all candidates (HEAD check, M3U magic bytes)
    5. Cache validated list to disk + memory

    Returns the full list of validated extra M3U sources.
    Set force=True to bypass the 6-hour cache window.
    """
    global _discovered, _last_run_at

    now = time.time()
    if not force and now - _last_run_at < _REDISCOVER_INTERVAL and _discovered:
        return list(_discovered)

    logger.info("M3U Discovery: starting crawl (force=%s)…", force)
    candidates: set[str] = set()

    # 1. Previously validated (disk cache)
    for url in _load_cache():
        candidates.add(url)

    # 2. Static seeds
    for url in _EXTRA_SPORTS_SEEDS:
        candidates.add(url)

    # 3. Crawl index pages
    for page in _CRAWL_PAGES:
        extracted = _crawl_m3u_urls_from_page(page)
        for url in extracted:
            candidates.add(url)
        logger.debug("Discovery: crawled %s → %d candidate(s)", page, len(extracted))

    logger.info("Discovery: validating %d candidate sources…", len(candidates))

    # 4. Validate in parallel (max 8 threads to respect rate limits)
    valid: list[str] = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(_is_valid_m3u, url): url for url in candidates}
        for fut in as_completed(futures):
            url = futures[fut]
            try:
                if fut.result():
                    valid.append(url)
                    logger.debug("Discovery: ✓ valid  %s", url)
                else:
                    logger.debug("Discovery: ✗ dead   %s", url)
            except Exception as exc:
                logger.debug("Discovery: error checking %s — %s", url, exc)

    _discovered = valid
    _last_run_at = now
    _save_cache(valid)

    logger.info("M3U Discovery complete: %d valid source(s) found", len(valid))
    return list(valid)


def get_cached_discovered_sources() -> list[str]:
    """
    Return the in-memory cached sources without network requests.
    Falls back to disk cache on first call after startup.
    """
    if _discovered:
        return list(_discovered)
    return _load_cache()
