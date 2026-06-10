from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timedelta, timezone
from threading import Lock

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_get_json, cache_set_json, invalidate_list_caches
from app.core.config import settings
from app.db.session import get_db
from app.models.channel import Channel
from app.models.live_fixture import LiveFixture
from app.schemas.channel import ChannelFiltersResponse, ChannelListResponse, ChannelRead
from app.schemas.live_fixture import LiveFixtureListResponse, LiveFixtureRead

logger = logging.getLogger("app.sports_tv")

# ---------------------------------------------------------------------------
# ILIKE wildcard escape
# ---------------------------------------------------------------------------

def _esc(s: str) -> str:
    """Escape ILIKE wildcards to prevent unintended broad matches."""
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


# ---------------------------------------------------------------------------
# In-memory rate limiting
# ---------------------------------------------------------------------------

_rate_store: dict[str, list[float]] = {}
_rate_lock = Lock()


def _check_rate_limit(key: str, max_requests: int = 100, window_seconds: int = 60) -> bool:
    """Returns True if allowed, False if rate limited. Thread-safe sliding-window.
    Bounded memory: empty keys are deleted; emergency clear if >5000 unique IPs."""
    now = time.monotonic()
    with _rate_lock:
        cutoff = now - window_seconds
        pruned = [t for t in _rate_store.get(key, []) if t > cutoff]

        if len(pruned) >= max_requests:
            _rate_store[key] = pruned  # keep pruned but don't add new timestamp
            return False

        pruned.append(now)

        if pruned:
            _rate_store[key] = pruned
        else:
            _rate_store.pop(key, None)  # shouldn't happen, but guard

        # Emergency cleanup when too many unique IPs are tracked
        if len(_rate_store) > 5_000:
            stale = [k for k, v in list(_rate_store.items())
                     if not v or v[-1] < cutoff]
            for k in stale:
                del _rate_store[k]
            if len(_rate_store) > 5_000:
                _rate_store.clear()
                logger.warning("rate_store emergency clear: >5000 active IPs")

        return True


router = APIRouter(prefix="/sports-tv", tags=["sports-tv"])

CHANNELS_CACHE_HEADER = f"public, s-maxage={min(settings.cache_ttl_seconds, 300)}, stale-while-revalidate=120"
CDN_CACHE_HEADER = f"public, s-maxage={min(settings.cache_ttl_seconds, 300)}"

_FIXTURE_ATTRIBUTION = {
    "openligadb": "Schedule: OpenLigaDB (api.openligadb.de) — official league fixtures; not affiliated.",
    "football-data.org": "Schedule: football-data.org (free tier / your API token).",
    "cricapi": "Schedule: CricAPI / CricketData.org (free tier 100 calls/day).",
}


@router.get("/fixtures", response_model=LiveFixtureListResponse)
async def list_live_fixtures(
    response: Response,
    db: AsyncSession = Depends(get_db),
    hours_back: int = Query(default=6, ge=0, le=120),
    days_ahead: int = Query(default=14, ge=1, le=30),
) -> LiveFixtureListResponse:
    """Real upcoming/recent fixtures from DB (filled by background sync). Channel links are name-match hints only."""
    response.headers["Cache-Control"] = "public, s-maxage=120, stale-while-revalidate=60"

    now = datetime.now(tz=timezone.utc)
    from_dt = now - timedelta(hours=hours_back)
    to_dt = now + timedelta(days=days_ahead)

    params = {"from": from_dt.isoformat(), "to": to_dt.isoformat()}
    cached = cache_get_json("fixtures", params)
    if cached is not None:
        try:
            return LiveFixtureListResponse.model_validate(cached)
        except Exception:
            logger.debug("fixtures cache parse miss")

    try:
        result = await db.execute(
            select(LiveFixture)
            .where(LiveFixture.starts_at_utc >= from_dt, LiveFixture.starts_at_utc <= to_dt)
            .order_by(LiveFixture.starts_at_utc.asc())
            .limit(500)
        )
        rows = list(result.scalars().all())
    except SQLAlchemyError as exc:
        logger.warning("fixtures query failed, returning empty list: %s", exc)
        return LiveFixtureListResponse(items=[], updated_hint=None)

    all_ids: set[int] = set()
    for r in rows:
        raw = r.suggested_channel_ids
        if not raw:
            continue
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                for x in parsed:
                    if isinstance(x, int):
                        all_ids.add(x)
        except json.JSONDecodeError:
            continue

    ch_map: dict[int, Channel] = {}
    if all_ids:
        cr = await db.execute(select(Channel).where(Channel.id.in_(all_ids)))
        for ch in cr.scalars().all():
            ch_map[ch.id] = ch

    items: list[LiveFixtureRead] = []
    max_updated: datetime | None = None
    for r in rows:
        if max_updated is None or r.updated_at > max_updated:
            max_updated = r.updated_at
        sug_reads: list[ChannelRead] = []
        try:
            for cid in json.loads(r.suggested_channel_ids or "[]"):
                if not isinstance(cid, int):
                    continue
                ch = ch_map.get(cid)
                if ch and ch.is_active:
                    sug_reads.append(ChannelRead.model_validate(ch))
        except json.JSONDecodeError:
            pass
        items.append(
            LiveFixtureRead(
                id=r.id,
                source=r.source,
                external_id=r.external_id,
                competition_key=r.competition_key,
                league_name=r.league_name,
                home_team=r.home_team,
                away_team=r.away_team,
                sport=r.sport,
                starts_at_utc=r.starts_at_utc,
                status=r.status,
                score_text=r.score_text,
                thumb_url=r.thumb_url,
                data_attribution=_FIXTURE_ATTRIBUTION.get(r.source, f"Schedule source: {r.source}"),
                suggested_channels=sug_reads,
            )
        )

    out = LiveFixtureListResponse(items=items, updated_hint=max_updated)
    try:
        cache_set_json("fixtures", params, out.model_dump(mode="json"), ttl=120)
    except Exception as e:
        logger.debug("fixtures cache set failed: %s", e)
    return out


@router.get("/channels", response_model=ChannelListResponse)
async def list_channels(
    request: Request,
    response: Response,
    search: str | None = Query(default=None, min_length=1, max_length=120),
    country: str | None = Query(default=None, min_length=1, max_length=120),
    category: str | None = Query(default=None, min_length=1, max_length=120),
    language: str | None = Query(default=None, min_length=1, max_length=120),
    module: str | None = Query(default=None, min_length=1, max_length=40),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> ChannelListResponse:
    from fastapi import HTTPException

    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(f"channels:{client_ip}"):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment.")

    response.headers["Cache-Control"] = CHANNELS_CACHE_HEADER
    response.headers["CDN-Cache-Control"] = CDN_CACHE_HEADER
    response.headers["Vary"] = "Accept-Encoding"

    # Extract visitor country FIRST — used in both cache-hit and fresh-query paths.
    # Cloudflare header injected by Vercel CDN; fallback header for other proxies.
    cf_country = (
        request.headers.get("CF-IPCountry")
        or request.headers.get("X-Country")
        or ""
    ).upper()[:2]
    # Log if geo-detection is missing (for debugging production issues)
    if not cf_country:
        logger.debug(
            "No geo-country detected. CF-IPCountry and X-Country headers missing. "
            "Ensure Cloudflare is active or set X-Country header for geo-sorting to work."
        )

    params = {
        "search": search,
        "country": country,
        "category": category,
        "language": language,
        "module": module,
        "page": page,
        "page_size": page_size,
    }
    cached = cache_get_json("channels", params)
    if cached is not None:
        try:
            result = ChannelListResponse.model_validate(cached)
            # Apply geo-sort AFTER reading from cache so the cached copy is
            # country-neutral and all users share the same cache entry.
            if cf_country:
                result.items.sort(
                    key=lambda c: 0 if c.country.upper()[:2] == cf_country else 1
                )
            return result
        except Exception:
            logger.debug("cache miss parse, refetching")

    base_query = select(Channel).where(Channel.is_active.is_(True))

    if search:
        base_query = base_query.where(Channel.name.ilike(f"%{_esc(search)}%", escape="\\"))
    if country:
        base_query = base_query.where(Channel.country.ilike(f"%{_esc(country)}%", escape="\\"))
    if category:
        base_query = base_query.where(Channel.category.ilike(f"%{_esc(category)}%", escape="\\"))
    if language:
        base_query = base_query.where(Channel.language.ilike(f"%{_esc(language)}%", escape="\\"))
    if module:
        base_query = base_query.where(Channel.module == module)

    try:
        subq = base_query.subquery()
        total = (await db.execute(select(func.count()).select_from(subq))).scalar() or 0

        channels = list(
            (
                await db.execute(
                    base_query.order_by(Channel.updated_at.desc(), Channel.name.asc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            )
            .scalars()
            .all()
        )
    except SQLAlchemyError as exc:
        logger.warning("channels query failed: %s", exc)
        from fastapi import HTTPException as _HTTPException
        raise _HTTPException(status_code=503, detail="Database temporarily unavailable. Please try again.")

    result = ChannelListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[ChannelRead.model_validate(channel) for channel in channels],
    )

    # Cache the UNSORTED result so all users share the same cache entry.
    # Geo-sort is applied per-request after reading from cache.
    try:
        cache_set_json("channels", params, result.model_dump(mode="json"))
    except Exception as e:
        logger.debug("cache set failed: %s", e)

    # Geo-sort: same-country channels float to top of the page (stable sort).
    # Does NOT affect total count or pagination offsets.
    if cf_country:
        result.items.sort(
            key=lambda c: 0 if c.country.upper()[:2] == cf_country else 1
        )

    return result


@router.get("/filters", response_model=ChannelFiltersResponse)
async def get_filters(db: AsyncSession = Depends(get_db)) -> ChannelFiltersResponse:
    """Return distinct filter values available for active channels."""
    cached = cache_get_json("channel_filters", {})
    if cached is not None:
        try:
            return ChannelFiltersResponse.model_validate(cached)
        except Exception:
            pass

    active = Channel.is_active.is_(True)

    countries_q = await db.execute(
        select(Channel.country).where(active).distinct().order_by(Channel.country)
    )
    categories_q = await db.execute(
        select(Channel.category).where(active).distinct().order_by(Channel.category)
    )
    languages_q = await db.execute(
        select(Channel.language).where(active).distinct().order_by(Channel.language)
    )
    modules_q = await db.execute(
        select(Channel.module).where(active).distinct().order_by(Channel.module)
    )

    result = ChannelFiltersResponse(
        countries=sorted([r for r in countries_q.scalars().all() if r]),
        categories=sorted([r for r in categories_q.scalars().all() if r]),
        languages=sorted([r for r in languages_q.scalars().all() if r]),
        modules=sorted([r for r in modules_q.scalars().all() if r]),
    )
    try:
        cache_set_json("channel_filters", {}, result.model_dump(mode="json"))
    except Exception as e:
        logger.debug("filter cache set failed: %s", e)
    return result


@router.post("/invalidate-cache")
async def invalidate_sports_tv_cache() -> dict[str, str]:
    """
    Public: flush server-side list caches (Redis) for /channels and /filters.

    Safe: does not require auth. Call after re-deploy or to bust stale list data.
    Vercel/CDN may still cache briefly — use a hard browser refresh or wait for s-maxage.
    """
    invalidate_list_caches()
    return {"detail": "ok", "message": "Channel and filter list caches cleared"}


@router.get("/channels/{channel_id}", response_model=ChannelRead)
async def get_channel(channel_id: int, db: AsyncSession = Depends(get_db)) -> ChannelRead:
    from fastapi import HTTPException, status

    channel = await db.get(Channel, channel_id)
    if channel is None or not channel.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    return ChannelRead.model_validate(channel)
