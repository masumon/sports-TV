from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool
from starlette.responses import Response

from app.core.cache import invalidate_list_caches
from app.core.config import settings
from app.core.security import get_current_admin_user
from app.core.sync_rate_limit import check_sync_allowed, get_last_sync_iso, mark_sync_success
from app.db.session import SessionLocal, get_db
from app.models.channel import Channel
from app.models.dynamic_stream import DynamicStream
from app.models.match_stats import MatchStats, MatchStatus, SportType
from app.models.user import User
from app.schemas.admin import AdminStatsResponse
from app.schemas.channel import ChannelCreate, ChannelRead, ChannelUpdate
from app.schemas.dynamic_stream import DynamicStreamCreate, DynamicStreamRead, DynamicStreamUpdate
from app.schemas.match_stats import MatchStatsCreate, MatchStatsRead, MatchStatsUpdate
from app.services.channel_cleanup import run_full_cleanup
from app.services.iptv_scraper import scrape_and_sync_sports_channels
from app.services.m3u_discovery import get_cached_discovered_sources

router = APIRouter(prefix="/admin", tags=["Admin"])


def _sync_m3u_blocking() -> dict[str, int]:
    sdb = SessionLocal()
    try:
        discovered = get_cached_discovered_sources()
        result = scrape_and_sync_sports_channels(sdb, extra_urls=discovered or None)
        run_full_cleanup(sdb, stale_days=settings.channel_stale_days)
        return result
    finally:
        sdb.close()


@router.get("/stats", response_model=AdminStatsResponse)
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> AdminStatsResponse:
    u = (await db.execute(select(func.count()).select_from(User.__table__))).scalar() or 0
    c = (await db.execute(select(func.count()).select_from(Channel.__table__))).scalar() or 0
    s = (await db.execute(select(func.count()).select_from(MatchStats.__table__))).scalar() or 0
    active = (
        await db.execute(select(func.count()).select_from(Channel).where(Channel.is_active.is_(True)))
    ).scalar() or 0
    return AdminStatsResponse(
        users=int(u),
        channels=int(c),
        live_scores=int(s),
        active_channels=int(active),
        cache_ttl_seconds=settings.cache_ttl_seconds,
        scheduled_sync_minutes=settings.scheduled_sync_interval_minutes,
        last_sync_at=get_last_sync_iso(),
    )


@router.post("/channels/sync", response_model=dict[str, int])
async def sync_channels(
    _db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> dict[str, int]:
    del _db
    check_sync_allowed()
    result = await run_in_threadpool(_sync_m3u_blocking)
    mark_sync_success()
    invalidate_list_caches()
    return result


@router.get("/channels", response_model=list[ChannelRead])
async def admin_list_channels(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> list[ChannelRead]:
    stmt = select(Channel).order_by(Channel.updated_at.desc())
    r = await db.execute(stmt)
    chans = r.scalars().all()
    return [ChannelRead.model_validate(c) for c in chans]


@router.post("/channels", response_model=ChannelRead, status_code=status.HTTP_201_CREATED)
async def admin_create_channel(
    payload: ChannelCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> Channel:
    r = await db.execute(select(Channel).where(Channel.stream_url == str(payload.stream_url)))
    exists = r.scalars().first()
    if exists:
        raise HTTPException(status_code=400, detail="Stream URL already exists.")

    channel = Channel(
        name=payload.name.strip(),
        country=payload.country.strip(),
        category=payload.category.strip(),
        language=payload.language.strip(),
        logo_url=str(payload.logo_url) if payload.logo_url else None,
        stream_url=str(payload.stream_url),
        quality_tag=payload.quality_tag.strip().lower(),
        is_active=payload.is_active,
        source="manual",
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    invalidate_list_caches()
    return channel


@router.put("/channels/{channel_id}", response_model=ChannelRead)
async def admin_update_channel(
    channel_id: int,
    payload: ChannelUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> Channel:
    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found.")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field in {"logo_url", "stream_url"} and value is not None:
            setattr(channel, field, str(value))
        else:
            setattr(channel, field, value)

    await db.commit()
    await db.refresh(channel)
    invalidate_list_caches()
    return channel


@router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_channel(
    channel_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> Response:
    r = await db.execute(delete(Channel).where(Channel.id == channel_id))
    if r.rowcount == 0:
        raise HTTPException(status_code=404, detail="Channel not found.")
    await db.commit()
    invalidate_list_caches()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _parse_sport(value: str) -> SportType:
    normalized = value.lower().strip()
    if normalized == "football":
        return SportType.football
    if normalized == "cricket":
        return SportType.cricket
    raise HTTPException(status_code=400, detail="sport_type must be football or cricket.")


def _parse_status(value: str) -> MatchStatus:
    normalized = value.lower().strip()
    if normalized == "live":
        return MatchStatus.live
    if normalized == "upcoming":
        return MatchStatus.upcoming
    if normalized == "finished":
        return MatchStatus.finished
    raise HTTPException(status_code=400, detail="status must be live, upcoming, or finished.")


@router.get("/scores", response_model=list[MatchStatsRead])
async def admin_list_scores(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> list[MatchStatsRead]:
    stmt = select(MatchStats).order_by(MatchStats.updated_at.desc())
    r = await db.execute(stmt)
    return [MatchStatsRead.model_validate(s) for s in r.scalars().all()]


@router.post("/scores", response_model=MatchStatsRead, status_code=status.HTTP_201_CREATED)
async def admin_create_score(
    payload: MatchStatsCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> MatchStats:
    score = MatchStats(
        sport_type=_parse_sport(payload.sport_type),
        league=payload.league,
        team_home=payload.team_home,
        team_away=payload.team_away,
        score_home=payload.score_home,
        score_away=payload.score_away,
        match_minute=payload.match_minute,
        status=_parse_status(payload.status),
        extra_data=payload.extra_data,
    )
    db.add(score)
    await db.commit()
    await db.refresh(score)
    invalidate_list_caches()
    return score


@router.put("/scores/{score_id}", response_model=MatchStatsRead)
async def admin_update_score(
    score_id: int,
    payload: MatchStatsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> MatchStats:
    score = await db.get(MatchStats, score_id)
    if not score:
        raise HTTPException(status_code=404, detail="Live score not found.")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field == "sport_type" and value is not None:
            score.sport_type = _parse_sport(value)
            continue
        if field == "status" and value is not None:
            score.status = _parse_status(value)
            continue
        setattr(score, field, value)

    await db.commit()
    await db.refresh(score)
    invalidate_list_caches()
    return score


@router.delete("/scores/{score_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_score(
    score_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> Response:
    r = await db.execute(delete(MatchStats).where(MatchStats.id == score_id))
    if r.rowcount == 0:
        raise HTTPException(status_code=404, detail="Live score not found.")
    await db.commit()
    invalidate_list_caches()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Dynamic Stream Admin CRUD  (/api/v1/admin/dynamic-streams)
# ─────────────────────────────────────────────────────────────────────────────
# Manage DynamicStream records — the source pages Playwright scrapes to
# obtain token-protected .m3u8 URLs.
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/dynamic-streams", response_model=list[DynamicStreamRead])
async def admin_list_dynamic_streams(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> list[DynamicStreamRead]:
    """Return all DynamicStream records, newest first."""
    stmt = select(DynamicStream).order_by(DynamicStream.updated_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    return [DynamicStreamRead.model_validate(row) for row in rows]


@router.post(
    "/dynamic-streams",
    response_model=DynamicStreamRead,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_dynamic_stream(
    payload: DynamicStreamCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> DynamicStreamRead:
    """
    Register a new streaming page for Playwright-based .m3u8 extraction.

    The scheduler will automatically extract the first .m3u8 URL within the
    next refresh cycle (configurable via M3U8_REFRESH_INTERVAL_MINUTES).
    """
    existing = (
        await db.execute(
            select(DynamicStream).where(
                DynamicStream.source_page_url == payload.source_page_url
            )
        )
    ).scalars().first()
    if existing:
        raise HTTPException(
            status_code=400, detail="A stream for this source page already exists."
        )

    stream = DynamicStream(
        name=payload.name.strip(),
        source_page_url=payload.source_page_url.strip(),
        token_ttl_seconds=payload.token_ttl_seconds,
        is_active=payload.is_active,
    )
    db.add(stream)
    await db.commit()
    await db.refresh(stream)
    return DynamicStreamRead.model_validate(stream)


@router.put("/dynamic-streams/{stream_id}", response_model=DynamicStreamRead)
async def admin_update_dynamic_stream(
    stream_id: int,
    payload: DynamicStreamUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> DynamicStreamRead:
    """Update metadata for a DynamicStream record."""
    stream: DynamicStream | None = await db.get(DynamicStream, stream_id)
    if not stream:
        raise HTTPException(status_code=404, detail="Dynamic stream not found.")

    data = payload.model_dump(exclude_unset=True)
    for field_name, value in data.items():
        setattr(stream, field_name, value)

    await db.commit()
    await db.refresh(stream)
    return DynamicStreamRead.model_validate(stream)


@router.delete("/dynamic-streams/{stream_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_dynamic_stream(
    stream_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> Response:
    """Permanently delete a DynamicStream record."""
    r = await db.execute(delete(DynamicStream).where(DynamicStream.id == stream_id))
    if r.rowcount == 0:
        raise HTTPException(status_code=404, detail="Dynamic stream not found.")
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/dynamic-streams/{stream_id}/refresh", response_model=DynamicStreamRead)
async def admin_trigger_m3u8_refresh(
    stream_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> DynamicStreamRead:
    """
    Manually trigger an immediate .m3u8 re-extraction for the given stream.

    Runs Playwright in a thread-pool so the HTTP response is not blocked.
    Returns the updated record (or the unchanged record if extraction fails).
    """
    import json as _json
    from datetime import datetime, timezone
    from starlette.concurrency import run_in_threadpool
    from app.services.playwright_extractor import extract_m3u8_from_page

    stream: DynamicStream | None = await db.get(DynamicStream, stream_id)
    if not stream:
        raise HTTPException(status_code=404, detail="Dynamic stream not found.")

    source_url = stream.source_page_url
    token_ttl = stream.token_ttl_seconds

    def _do_extract() -> object:
        return extract_m3u8_from_page(
            source_url,
            token_ttl_seconds=token_ttl,
            use_cache=False,  # force fresh extraction on manual trigger
        )

    result = await run_in_threadpool(_do_extract)

    if result is not None:
        # Promote current URL to fallback before overwriting.
        if stream.m3u8_url:
            stream.fallback_m3u8_url = stream.m3u8_url
            stream.fallback_headers_json = stream.headers_json
        stream.m3u8_url = result.m3u8_url
        stream.headers_json = _json.dumps(result.headers)
        stream.expires_at = result.expires_at
        stream.last_refreshed_at = datetime.now(tz=timezone.utc)
        await db.commit()
        await db.refresh(stream)

    return DynamicStreamRead.model_validate(stream)
