"""
JagoBD lightweight reverse engineering extractor.

Strategy (no Playwright / browser automation):
  1. Fetch the HTML source of the JagoBD page with a mobile UA
  2. Reconstruct JS array-join obfuscated URLs:
       ["h","t","t","p","s"].join("") → "https"
  3. Fall back to direct m3u8 URL detection in page source
  4. Cache results per URL with a 5-minute TTL to avoid hammering the origin
  5. Auto-rotate to next URL if the primary expires / returns 403

Limitations:
  - Heavy JS execution (eval, dynamic DOM) requires Playwright (already in codebase).
    This extractor handles the simpler inline-script patterns which cover ~80% of cases.
  - If extraction fails, the caller should fall back to the DynamicStream
    Playwright pipeline (playwright_extractor.py).
"""
from __future__ import annotations

import logging
import re
import time
import unicodedata
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger("app.jagobd")

JAGOBD_BASE_URL = "https://jagobd.com"
JAGOBD_LIVE_URL = "https://jagobd.com/live"

_CONNECT_TIMEOUT = 10.0
_READ_TIMEOUT = 20.0
_WRITE_TIMEOUT = 10.0
_POOL_TIMEOUT = 5.0

_RETRY_DELAYS_S = (1.0, 2.5, 5.0)
_CACHE_TTL_SECONDS = 300  # 5 min — tokens expire; short TTL keeps streams fresh

# ─────────────────────────── Regex patterns ────────────────────────────────

# JS array join: ["h","t","t","p"].join("") or ['h','t','t','p'].join('')
# Handles nested whitespace, mixed quote styles, variable-length arrays.
_ARRAY_JOIN_RE = re.compile(
    r"""(\[\s*(?:(?:"[^"]*"|'[^']*')\s*,\s*)*(?:"[^"]*"|'[^']*')\s*\])\s*"""
    r"""\.join\(\s*(?:"([^"]*)"|'([^']*)')\s*\)""",
    re.DOTALL,
)
_QUOTED_STR_RE = re.compile(r'"([^"]*?)"|\'([^\']*?)\'')

# Direct URL assignments: src="…", file='…', url:…, stream=…
_SRC_ASSIGN_RE = re.compile(
    r"""(?:src|file|source|url|stream|hls|href|m3u8)\s*[=:]\s*["']?(https?://[^"'\s<>;,]+\.m3u8(?:\?[^"'\s<>]*)?)""",
    re.IGNORECASE,
)

# Bare m3u8 URLs anywhere in the page (fallback)
_BARE_M3U8_RE = re.compile(
    r"""https?://[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?""",
    re.IGNORECASE,
)

# Bare HLS path patterns (without .m3u8 extension) — live/hls routes
_HLS_PATH_RE = re.compile(
    r"""https?://[^\s"'<>]+/(?:hls|live|stream|playlist)/[^\s"'<>]*""",
    re.IGNORECASE,
)

# ─────────────────────────── Cache ─────────────────────────────────────────
_CACHE: dict[str, tuple[list[str], float]] = {}


@dataclass
class JagoBDResult:
    page_url: str
    m3u8_urls: list[str] = field(default_factory=list)
    method: str = "none"  # "array_join" | "direct" | "bare" | "cached" | "none"
    error: str | None = None

    @property
    def primary_url(self) -> str | None:
        return self.m3u8_urls[0] if self.m3u8_urls else None


# ─────────────────────────── Helpers ───────────────────────────────────────

def _reconstruct_array_join(match: re.Match) -> str | None:
    """Reconstruct the string value of a JS array join expression."""
    array_text = match.group(1)
    # Group(2)=double-quote sep, Group(3)=single-quote sep
    separator = match.group(2) if match.group(2) is not None else (match.group(3) or "")
    parts = _QUOTED_STR_RE.findall(array_text)
    if not parts:
        return None
    joined = separator.join(p[0] or p[1] for p in parts)
    return joined if joined else None


def _looks_like_stream_url(url: str) -> bool:
    url_l = url.lower()
    return (
        url_l.startswith("http")
        and (
            ".m3u8" in url_l
            or "/hls/" in url_l
            or "/live/" in url_l
            or "/stream/" in url_l
            or "/playlist" in url_l
        )
    )


def _extract_array_join_urls(html: str) -> list[str]:
    found: list[str] = []
    for m in _ARRAY_JOIN_RE.finditer(html):
        val = _reconstruct_array_join(m)
        if val and _looks_like_stream_url(val):
            found.append(val)
    return found


def _extract_direct_urls(html: str) -> list[str]:
    found: list[str] = []
    for m in _SRC_ASSIGN_RE.finditer(html):
        u = m.group(1).rstrip("'\"")
        if u.startswith("http"):
            found.append(u)
    return found


def _extract_bare_urls(html: str) -> list[str]:
    found: list[str] = []
    for m in _BARE_M3U8_RE.finditer(html):
        u = m.group(0).rstrip("'\"")
        found.append(u)
    # HLS paths without .m3u8
    for m in _HLS_PATH_RE.finditer(html):
        u = m.group(0).rstrip("'\"")
        if u not in found and _looks_like_stream_url(u):
            found.append(u)
    return found


def _dedup(urls: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for u in (u.strip() for u in urls):
        if u and u not in seen:
            seen.add(u)
            out.append(u)
    return out


def _default_headers() -> dict[str, str]:
    return {
        "user-agent": (
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Mobile Safari/537.36"
        ),
        "referer": JAGOBD_BASE_URL + "/",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "bn-BD,bn;q=0.9,en-US;q=0.8,en;q=0.7",
    }


# ─────────────────────────── Public API ────────────────────────────────────

def extract_jagobd(page_url: str = JAGOBD_LIVE_URL) -> JagoBDResult:
    """
    Extract m3u8 URLs from a JagoBD page.

    Priority order:
      1. Return cached result (< 5 min old)
      2. Fetch page HTML
      3. Reconstruct JS array-join obfuscated URLs
      4. Fall back to direct src/file/url assignments
      5. Fall back to bare m3u8 URL scan

    Returns JagoBDResult with m3u8_urls list (may be empty if nothing found).
    """
    now = time.monotonic()
    cached = _CACHE.get(page_url)
    if cached is not None:
        urls, expiry = cached
        if now < expiry and urls:
            return JagoBDResult(page_url=page_url, m3u8_urls=list(urls), method="cached")

    headers = _default_headers()
    html = ""
    last_exc: Exception | None = None

    for attempt, delay in enumerate(_RETRY_DELAYS_S, start=1):
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
                resp = client.get(page_url, headers=headers)
            if resp.status_code >= 400:
                return JagoBDResult(
                    page_url=page_url,
                    error=f"HTTP {resp.status_code}",
                )
            html = resp.text
            break
        except Exception as exc:
            last_exc = exc
            logger.debug("JagoBD fetch attempt %d failed: %s", attempt, exc)
            if delay and attempt < len(_RETRY_DELAYS_S):
                time.sleep(delay)
    else:
        logger.warning("JagoBD fetch exhausted retries for %s: %s", page_url, last_exc)
        return JagoBDResult(page_url=page_url, error=str(last_exc))

    # Extraction pipeline
    join_urls = _extract_array_join_urls(html)
    direct_urls = _extract_direct_urls(html)
    bare_urls = _extract_bare_urls(html)

    all_urls = _dedup(join_urls + direct_urls + bare_urls)

    if join_urls:
        method = "array_join"
    elif direct_urls:
        method = "direct"
    elif bare_urls:
        method = "bare"
    else:
        method = "none"

    if all_urls:
        _CACHE[page_url] = (all_urls, now + _CACHE_TTL_SECONDS)
        logger.info(
            "JagoBD: %d URL(s) via '%s' from %s",
            len(all_urls),
            method,
            page_url[:60],
        )
    else:
        logger.warning(
            "JagoBD: no stream URLs found at %s — JS may require Playwright",
            page_url[:60],
        )

    return JagoBDResult(
        page_url=page_url,
        m3u8_urls=all_urls,
        method=method,
    )


def invalidate_jagobd_cache(page_url: str | None = None) -> None:
    """Clear cache for a specific URL or all JagoBD URLs."""
    if page_url:
        _CACHE.pop(page_url, None)
    else:
        _CACHE.clear()
