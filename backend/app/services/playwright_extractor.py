"""
Playwright M3U8 Extraction Engine  (Dynamic Stream System)

Memory-safe, stealth-capable browser automation that:
- Launches Chromium ONLY when an extraction is needed
- Intercepts .m3u8 network requests and captures URL + required headers
- Blocks images / fonts / stylesheets to minimize RAM usage
- Closes the browser immediately after extraction
- Forces CPython garbage collection after every run
- Retries with exponential backoff on failure (1 s → 2 s → 4 s → 8 s)
- Caches the result in Redis to avoid duplicate scraping

Usage (sync — safe to call from APScheduler BackgroundScheduler threads):
    result = extract_m3u8_from_page(source_page_url, token_ttl_seconds=3600)
    if result:
        # result.m3u8_url, result.headers, result.expires_at
"""
from __future__ import annotations

import gc
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

logger = logging.getLogger("app.playwright_extractor")

# Resource types that add zero value to stream extraction but consume memory.
_BLOCKED_RESOURCE_TYPES: frozenset[str] = frozenset(
    {"image", "stylesheet", "font", "media", "other"}
)

# A realistic desktop User-Agent; avoids trivial bot detection.
# Keep this reasonably current to avoid triggering bot-detection rules.
_STEALTH_USER_AGENT: str = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# Chromium launch flags tuned for a low-memory (~512 MB) environment.
_CHROMIUM_ARGS: list[str] = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",          # avoids /dev/shm OOM on Docker/Render
    "--disable-gpu",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--single-process",                 # one renderer process; saves ~50 MB
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-ipc-flooding-protection",
    "--disable-features=TranslateUI",
    "--disable-popup-blocking",
    "--mute-audio",
]

# JavaScript injected into every page to erase common bot-detection signals.
_STEALTH_INIT_SCRIPT: str = """
(() => {
    // Hide automation flag
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // Fake a real plugin list
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    // Realistic language preferences
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    // Stub chrome runtime (absent in headless)
    window.chrome = { runtime: {} };
    // Stub permissions API to return 'granted'
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (params) =>
        params.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(params);
})();
"""

# How long to wait for page navigation (ms).
_NAV_TIMEOUT_MS: int = 30_000
# How long to wait after navigation for the .m3u8 request to appear (seconds).
_WAIT_FOR_M3U8_SECONDS: float = 20.0
# Poll interval while waiting for .m3u8 capture (seconds).
_POLL_INTERVAL_SECONDS: float = 0.5

# Headers we forward from the intercepted request.
_CAPTURE_HEADERS: frozenset[str] = frozenset(
    {"referer", "origin", "user-agent", "authorization", "cookie"}
)

# Redis TTL for caching the raw extraction result JSON.
_REDIS_CACHE_TTL_BUFFER_SECONDS: int = 60  # expire cache 60 s before token does


@dataclass
class ExtractionResult:
    """Successful extraction result from Playwright."""
    m3u8_url: str
    headers: dict[str, str] = field(default_factory=dict)
    expires_at: datetime = field(
        default_factory=lambda: datetime.now(tz=timezone.utc) + timedelta(hours=1)
    )


def _redis_cache_key(source_page_url: str) -> str:
    import hashlib
    digest = hashlib.sha256(source_page_url.encode()).hexdigest()[:20]
    return f"gstv:m3u8extract:{digest}"


def _load_from_redis(source_page_url: str) -> ExtractionResult | None:
    """Return a cached ExtractionResult from Redis, or None on miss/error."""
    try:
        from app.core.redis_client import safe_get
        raw = safe_get(_redis_cache_key(source_page_url))
        if not raw:
            return None
        data = json.loads(raw)
        expires_at = datetime.fromisoformat(data["expires_at"])
        # Reject stale cached results
        if expires_at <= datetime.now(tz=timezone.utc) + timedelta(minutes=15):
            return None
        return ExtractionResult(
            m3u8_url=data["m3u8_url"],
            headers=data.get("headers", {}),
            expires_at=expires_at,
        )
    except Exception as exc:
        logger.debug("Redis m3u8 cache load failed: %s", exc)
        return None


def _save_to_redis(source_page_url: str, result: ExtractionResult) -> None:
    """Persist an ExtractionResult to Redis for deduplication."""
    try:
        from app.core.redis_client import safe_set
        now = datetime.now(tz=timezone.utc)
        remaining = (result.expires_at - now).total_seconds()
        ttl = max(int(remaining) - _REDIS_CACHE_TTL_BUFFER_SECONDS, 60)
        payload = json.dumps(
            {
                "m3u8_url": result.m3u8_url,
                "headers": result.headers,
                "expires_at": result.expires_at.isoformat(),
            }
        )
        safe_set(_redis_cache_key(source_page_url), payload, ttl=ttl)
    except Exception as exc:
        logger.debug("Redis m3u8 cache save failed: %s", exc)


def _run_playwright_extraction(
    source_page_url: str,
    token_ttl_seconds: int,
) -> ExtractionResult | None:
    """
    Core extraction: launch Chromium, navigate to the page, intercept .m3u8
    network requests, capture URL + headers, then close the browser.

    This function is intentionally synchronous so it can be called from
    APScheduler's BackgroundScheduler threads without asyncio conflicts.

    The browser is ALWAYS closed in the finally block regardless of outcome.
    gc.collect() is called by the caller (extract_m3u8_from_page) after each
    attempt, including failed ones.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.error(
            "playwright package not installed. "
            "Run: pip install playwright && playwright install chromium"
        )
        return None

    captured: dict[str, object] = {}

    def _on_request(request: object) -> None:
        """Fired for every network request the page makes."""
        if captured:  # already captured; skip further processing
            return
        req_url: str = request.url  # type: ignore[attr-defined]
        if ".m3u8" not in req_url:
            return
        raw_headers: dict[str, str] = dict(request.headers)  # type: ignore[attr-defined]
        captured["url"] = req_url
        captured["headers"] = {
            k: v for k, v in raw_headers.items() if k.lower() in _CAPTURE_HEADERS
        }
        logger.debug("M3U8 captured: %s", req_url[:120])

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=_CHROMIUM_ARGS)
        try:
            context = browser.new_context(
                user_agent=_STEALTH_USER_AGENT,
                viewport={"width": 1280, "height": 720},
                ignore_https_errors=True,
                java_script_enabled=True,
                bypass_csp=True,
            )
            try:
                context.add_init_script(_STEALTH_INIT_SCRIPT)
                page = context.new_page()
                try:
                    # Block unnecessary resource types to reduce memory load.
                    def _handle_route(route: object) -> None:
                        rtype: str = route.request.resource_type  # type: ignore[attr-defined]
                        if rtype in _BLOCKED_RESOURCE_TYPES:
                            route.abort()  # type: ignore[attr-defined]
                        else:
                            route.continue_()  # type: ignore[attr-defined]

                    page.route("**/*", _handle_route)  # type: ignore[attr-defined]
                    page.on("request", _on_request)  # type: ignore[attr-defined]

                    # Navigate — tolerate timeouts; the interception may still fire.
                    try:
                        page.goto(  # type: ignore[attr-defined]
                            source_page_url,
                            timeout=_NAV_TIMEOUT_MS,
                            wait_until="domcontentloaded",
                        )
                    except Exception as nav_exc:
                        logger.debug("Navigation timeout/error (non-fatal): %s", nav_exc)

                    # Try clicking a play button — many embedded players require it.
                    _try_click_play(page)

                    # Poll until .m3u8 is captured or timeout expires.
                    deadline = time.monotonic() + _WAIT_FOR_M3U8_SECONDS
                    while not captured and time.monotonic() < deadline:
                        try:
                            page.wait_for_timeout(int(_POLL_INTERVAL_SECONDS * 1000))  # type: ignore[attr-defined]
                        except Exception:
                            break

                    if not captured:
                        logger.warning(
                            "No .m3u8 intercepted from %s after %.0fs",
                            source_page_url,
                            _WAIT_FOR_M3U8_SECONDS,
                        )
                        return None

                    now = datetime.now(tz=timezone.utc)
                    return ExtractionResult(
                        m3u8_url=str(captured["url"]),
                        headers=dict(captured.get("headers", {})),  # type: ignore[arg-type]
                        expires_at=now + timedelta(seconds=token_ttl_seconds),
                    )
                finally:
                    try:
                        page.close()  # type: ignore[attr-defined]
                    except Exception:
                        pass
            finally:
                try:
                    context.close()  # type: ignore[attr-defined]
                except Exception:
                    pass
        finally:
            try:
                browser.close()  # type: ignore[attr-defined]
            except Exception:
                pass

    return None


def _try_click_play(page: object) -> None:
    """
    Attempt to click a video play button using common CSS selectors.
    Silently ignores any errors — this is a best-effort enhancement.
    """
    _PLAY_SELECTORS = [
        "button.play-button",
        "button[aria-label*='Play']",
        "button[title*='Play']",
        ".vjs-big-play-button",
        ".ytp-large-play-button",
        "[data-plyr='play']",
        ".play-btn",
        ".btn-play",
        "button.play",
        "[class*='play'][class*='btn']",
        "[class*='PlayButton']",
        "video",
    ]
    for selector in _PLAY_SELECTORS:
        try:
            el = page.query_selector(selector)  # type: ignore[attr-defined]
            if el:
                el.click(timeout=2000)  # type: ignore[attr-defined]
                logger.debug("Clicked play selector: %s", selector)
                return
        except Exception:
            continue


def extract_m3u8_from_page(
    source_page_url: str,
    token_ttl_seconds: int = 3600,
    max_retries: int = 4,
    use_cache: bool = True,
) -> ExtractionResult | None:
    """
    Public entry-point: extract the .m3u8 URL from ``source_page_url``.

    Features:
    - Redis cache check first (avoids duplicate scraping within the same
      token lifetime window).
    - Exponential back-off retry: 1 s → 2 s → 4 s → 8 s cap.
    - Forces gc.collect() after EVERY attempt (success or failure) to
      reclaim Chromium-process memory as fast as possible.
    - Never raises; always returns ExtractionResult | None.

    Args:
        source_page_url:   Web page that embeds the HLS player.
        token_ttl_seconds: Estimated lifetime of the extracted token;
                           used to set expires_at and Redis TTL.
        max_retries:       Maximum number of browser launch attempts.
        use_cache:         When True, check Redis before launching the browser.

    Returns:
        ExtractionResult on success, None on total failure.
    """
    if use_cache:
        cached = _load_from_redis(source_page_url)
        if cached is not None:
            logger.debug("M3U8 cache HIT for %s", source_page_url[:80])
            return cached

    last_exc: Exception | None = None
    for attempt in range(max_retries):
        if attempt > 0:
            delay = min(2 ** (attempt - 1), 8)  # 1 s, 2 s, 4 s, 8 s (capped)
            logger.info(
                "M3U8 extraction retry %d/%d for %s — waiting %ds",
                attempt + 1,
                max_retries,
                source_page_url[:80],
                delay,
            )
            time.sleep(delay)

        try:
            result = _run_playwright_extraction(source_page_url, token_ttl_seconds)
            if result is not None:
                _save_to_redis(source_page_url, result)
                logger.info(
                    "M3U8 extracted successfully from %s — expires_at=%s",
                    source_page_url[:80],
                    result.expires_at.isoformat(),
                )
                return result
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "M3U8 extraction attempt %d/%d error for %s: %s",
                attempt + 1,
                max_retries,
                source_page_url[:80],
                exc,
            )
        finally:
            # Force Python garbage collection after every browser run so that
            # the Chromium child-process resources are released promptly.
            gc.collect()

    logger.error(
        "All %d M3U8 extraction attempts failed for %s. Last error: %s",
        max_retries,
        source_page_url[:80],
        last_exc,
    )
    return None
