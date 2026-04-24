from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_get_json, cache_set_json
from app.core.config import settings
from app.db.session import get_db
from app.models.channel import Channel
from app.schemas.channel import ChannelFiltersResponse, ChannelListResponse, ChannelRead

logger = logging.getLogger("app.sports_tv")

router = APIRouter(prefix="/sports-tv", tags=["sports-tv"])

CHANNELS_CACHE_HEADER = f"public, s-maxage={min(settings.cache_ttl_seconds, 600)}, stale-while-revalidate=120"


@router.get("/channels", response_model=ChannelListResponse)
async def list_channels(
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
    response.headers["Cache-Control"] = CHANNELS_CACHE_HEADER
    response.headers["Vary"] = "Accept-Encoding"

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
            return ChannelListResponse.model_validate(cached)
        except Exception:
            logger.debug("cache miss parse, refetching")

    base_query = select(Channel).where(Channel.is_active.is_(True))

    if search:
        base_query = base_query.where(Channel.name.ilike(f"%{search}%"))
    if country:
        base_query = base_query.where(Channel.country.ilike(f"%{country}%"))
    if category:
        base_query = base_query.where(Channel.category.ilike(f"%{category}%"))
    if language:
        base_query = base_query.where(Channel.language.ilike(f"%{language}%"))
    if module:
        base_query = base_query.where(Channel.module == module)

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

    result = ChannelListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[ChannelRead.model_validate(channel) for channel in channels],
    )
    try:
        cache_set_json("channels", params, result.model_dump(mode="json"))
    except Exception as e:
        logger.debug("cache set failed: %s", e)
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

    base = select(Channel).where(Channel.is_active.is_(True))

    countries_q = await db.execute(
        select(distinct(Channel.country)).select_from(base.subquery()).order_by(Channel.country)
    )
    categories_q = await db.execute(
        select(distinct(Channel.category)).select_from(base.subquery()).order_by(Channel.category)
    )
    languages_q = await db.execute(
        select(distinct(Channel.language)).select_from(base.subquery()).order_by(Channel.language)
    )
    modules_q = await db.execute(
        select(distinct(Channel.module)).select_from(base.subquery()).order_by(Channel.module)
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


@router.get("/channels/{channel_id}", response_model=ChannelRead)
async def get_channel(channel_id: int, db: AsyncSession = Depends(get_db)) -> ChannelRead:
    from fastapi import HTTPException, status

    channel = await db.get(Channel, channel_id)
    if channel is None or not channel.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    return ChannelRead.model_validate(channel)
