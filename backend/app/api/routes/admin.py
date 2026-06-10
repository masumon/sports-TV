from __future__ import annotations

import json as _json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool
from starlette.responses import Response

from app.core.cache import invalidate_list_caches
from app.core.config import settings
from app.core.security import get_current_admin_user
from app.core.sync_rate_limit import (
    get_last_sync_iso,
    get_last_sync_status,
    get_last_sync_error,
    get_last_sweep_iso,
    get_last_sweep_checked,
    get_last_sweep_deactivated,
    check_sync_allowed,
)
from app.db.session import get_db
from app.models.channel import Channel
from app.models.dynamic_stream import DynamicStream
from app.models.user import User
from app.api.routes.proxy import _validate_stream_url
from app.schemas.admin import AdminStatsResponse, HealthSweepResponse, StreamProbeRequest, StreamProbeResponse
from app.services.stream_probe import run_probe_batch
from app.schemas.channel import ChannelCreate, ChannelRead, ChannelUpdate
from app.schemas.dynamic_stream import DynamicStreamCreate, DynamicStreamRead, DynamicStreamUpdate
from app.services.automation import run_channel_sync, run_health_sweep
from app.services.live_fixtures_sync import run_live_fixtures_sync_standalone

router = APIRouter(prefix="/admin", tags=["Admin"])


def _sync_m3u_blocking() -> dict[str, int]:
    return run_channel_sync(include_discovery=True, source="admin")


@router.get("/stats", response_model=AdminStatsResponse)
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> AdminStatsResponse:
    u = (await db.execute(select(func.count()).select_from(User.__table__))).scalar() or 0
    # Use consistent ORM-based counts for both total and active
    total = (await db.execute(select(func.count()).select_from(Channel))).scalar() or 0
    active = (
        await db.execute(select(func.count()).select_from(Channel).where(Channel.is_active.is_(True)))
    ).scalar() or 0
    inactive = (
        await db.execute(select(func.count()).select_from(Channel).where(Channel.is_active.is_(False)))
    ).scalar() or 0
    return AdminStatsResponse(
        users=int(u),
        channels=int(total),
        active_channels=int(active),
        inactive_channels=int(inactive),
        cache_ttl_seconds=settings.cache_ttl_seconds,
        scheduled_sync_minutes=settings.scheduled_sync_interval_minutes,
        last_sync_at=get_last_sync_iso(),
        last_sync_status=get_last_sync_status(),
        last_sync_error=get_last_sync_error(),
        last_sweep_at=get_last_sweep_iso(),
        last_sweep_checked=get_last_sweep_checked(),
        last_sweep_deactivated=get_last_sweep_deactivated(),
    )


@router.post("/proxy/probe", response_model=StreamProbeResponse)
async def admin_stream_probe(
    payload: StreamProbeRequest,
    _: User = Depends(get_current_admin_user),
) -> StreamProbeResponse:
    """
    Check stream URL reachability (HEAD, then tiny Range GET if needed).
    Results cached 10 minutes in Redis. SSRF-safe URL validation matches /proxy/stream.
    """
    seen: set[str] = set()
    unique: list[str] = []
    for u in payload.urls:
        s = (u or "").strip()
        if not s or s in seen:
            continue
        seen.add(s)
        unique.append(s)
    if not unique:
        return StreamProbeResponse(results=[])
    results = await run_probe_batch(unique, _validate_stream_url)
    return StreamProbeResponse(results=results)


@router.post("/fixtures/sync", response_model=dict[str, int])
async def sync_fixtures(
    _: User = Depends(get_current_admin_user),
) -> dict[str, int]:
    """Manually trigger a live fixture sync (OpenLigaDB + football-data.org)."""
    try:
        result = await run_in_threadpool(run_live_fixtures_sync_standalone)
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Fixture sync failed: {exc}",
        ) from exc


@router.post("/channels/sync", response_model=dict[str, int])
async def sync_channels(
    _db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> dict[str, int]:
    check_sync_allowed()
    del _db
    try:
        result = await run_in_threadpool(_sync_m3u_blocking)
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Channel sync failed: {exc}",
        ) from exc


@router.post("/channels/health-sweep", response_model=HealthSweepResponse)
async def health_sweep_channels(
    _: User = Depends(get_current_admin_user),
) -> HealthSweepResponse:
    """Check ALL active channels and auto-deactivate any with dead stream URLs.

    This is a heavy operation — it validates every active channel concurrently.
    Use on-demand; the scheduled health check already samples channels automatically.
    """
    import time as _time
    t0 = _time.monotonic()
    try:
        result = await run_in_threadpool(lambda: run_health_sweep(max_workers=30))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Health sweep failed: {exc}",
        ) from exc
    return HealthSweepResponse(
        checked=result.get("checked", 0),
        deactivated=result.get("deactivated", 0),
        duration_seconds=round(_time.monotonic() - t0, 1),
    )


@router.post("/channels/purge-inactive", response_model=dict[str, int])
async def purge_inactive_channels(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> dict[str, int]:
    """Legacy endpoint retained for API compatibility.

    Production safety policy keeps inactive channel rows for audit/recovery, so
    this route no longer performs physical deletes.
    """
    del db
    return {"deleted": 0}


@router.get("/channels", response_model=list[ChannelRead])
async def admin_list_channels(
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> list[ChannelRead]:
    stmt = (
        select(Channel)
        .where(Channel.is_active.is_(True))
        .order_by(Channel.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
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

    mod = (payload.module or "global_sports").strip().lower()
    if mod == "sports":
        mod = "global_sports"
    if mod not in ("global_sports", "bangladesh", "india", "fast_tv", "live_matches", "world_cup_2026"):
        mod = "global_sports"

    channel = Channel(
        name=payload.name.strip(),
        country=payload.country.strip(),
        category=payload.category.strip(),
        language=payload.language.strip(),
        logo_url=str(payload.logo_url) if payload.logo_url else None,
        stream_url=str(payload.stream_url),
        quality_tag=payload.quality_tag.strip().lower(),
        module=mod,
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
        elif field == "alternate_urls" and value is not None:
            setattr(channel, field, _json.dumps([str(url).strip() for url in value if str(url).strip()]))
        elif isinstance(value, str):
            setattr(channel, field, value.strip())
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
    channel = await db.get(Channel, channel_id)
    if channel is None:
        raise HTTPException(status_code=404, detail="Channel not found.")
    channel.is_active = False
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
