from __future__ import annotations

import json as _json
from functools import partial

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool
from starlette.responses import Response

from app.core.cache import invalidate_list_caches
from app.core.config import settings
from app.core.security import get_current_admin_user
from app.core.sync_rate_limit import (
    get_last_sync_created,
    get_last_sync_iso,
    get_last_sync_status,
    get_last_sync_error,
    get_last_sync_updated,
    get_last_sweep_iso,
    get_last_sweep_checked,
    get_last_sweep_deactivated,
)
from app.db.session import get_db
from app.models.channel import Channel
from app.models.dynamic_stream import DynamicStream
from app.models.user import User
from app.api.routes.proxy import _validate_stream_url
from app.schemas.admin import AdminStatsResponse, HealthSweepResponse, StreamProbeRequest, StreamProbeResponse
from app.services.stream_probe import run_probe_batch
from app.schemas.channel import ChannelCreate, ChannelListResponse, ChannelRead, ChannelUpdate
from app.schemas.dynamic_stream import DynamicStreamCreate, DynamicStreamRead, DynamicStreamUpdate
from app.services.automation import run_channel_sync, run_health_sweep, run_live_fixtures_job
from app.services.playlist_import import import_m3u8_from_content, get_playlists
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["Admin"])


def _sync_m3u_blocking() -> dict[str, int]:
    return run_channel_sync(include_discovery=True, source="admin")


@router.get("/stats", response_model=AdminStatsResponse)
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> AdminStatsResponse:
    from app.core.cache import cache_get_json, cache_set_json
    cached = cache_get_json("admin_stats", {})
    if cached is not None:
        try:
            return AdminStatsResponse.model_validate(cached)
        except Exception:
            pass
    u = (await db.execute(select(func.count()).select_from(User.__table__))).scalar() or 0
    # Use consistent ORM-based counts for both total and active
    total = (await db.execute(select(func.count()).select_from(Channel))).scalar() or 0
    active = (
        await db.execute(select(func.count()).select_from(Channel).where(Channel.is_active.is_(True)))
    ).scalar() or 0
    inactive = (
        await db.execute(select(func.count()).select_from(Channel).where(Channel.is_active.is_(False)))
    ).scalar() or 0
    module_rows = (
        await db.execute(
            select(Channel.module, func.count())
            .where(Channel.is_active.is_(True))
            .group_by(Channel.module)
        )
    ).all()
    active_module_counts = {str(mod): int(cnt) for mod, cnt in module_rows}
    result = AdminStatsResponse(
        users=int(u),
        channels=int(total),
        active_channels=int(active),
        inactive_channels=int(inactive),
        cache_ttl_seconds=settings.cache_ttl_seconds,
        scheduled_sync_minutes=settings.scheduled_sync_interval_minutes,
        last_sync_at=get_last_sync_iso(),
        last_sync_status=get_last_sync_status(),
        last_sync_error=get_last_sync_error(),
        last_sync_created=get_last_sync_created(),
        last_sync_updated=get_last_sync_updated(),
        last_sweep_at=get_last_sweep_iso(),
        last_sweep_checked=get_last_sweep_checked(),
        last_sweep_deactivated=get_last_sweep_deactivated(),
        active_module_counts=active_module_counts,
    )
    try:
        cache_set_json("admin_stats", {}, result.model_dump(mode="json"), ttl=60)
    except Exception:
        pass
    return result


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
    """Manually trigger a live fixture sync (OpenLigaDB + football-data.org + CricAPI)."""
    try:
        result = await run_in_threadpool(partial(run_live_fixtures_job, source="admin"))
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Fixture sync failed: {exc}",
        ) from exc


@router.post("/channels/sync")
async def sync_channels(
    _db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> dict[str, int | str]:
    """Trigger M3U channel sync. Lock + rate limit handled inside run_channel_sync."""
    del _db
    try:
        result = await run_in_threadpool(_sync_m3u_blocking)
        if result.get("skipped"):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Sync already running or rate limited. Please wait and retry.",
            )
        status_val = result.get("status")
        if status_val == "failed":
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=str(result.get("message") or "No channels parsed from any M3U source."),
            )
        return result
    except HTTPException:
        raise
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


def _normalize_module(mod: str | None) -> str:
    value = (mod or "global_sports").strip().lower()
    if value == "sports":
        value = "global_sports"
    if value not in ("global_sports", "bangladesh", "india", "fast_tv", "live_matches", "world_cup_2026"):
        return "global_sports"
    return value


@router.get("/channels", response_model=ChannelListResponse)
async def admin_list_channels(
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=500),
    status: str = Query("active", pattern="^(active|inactive|all)$"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> ChannelListResponse:
    count_stmt = select(func.count()).select_from(Channel)
    list_stmt = select(Channel).order_by(Channel.updated_at.desc())
    if status == "active":
        count_stmt = count_stmt.where(Channel.is_active.is_(True))
        list_stmt = list_stmt.where(Channel.is_active.is_(True))
    elif status == "inactive":
        count_stmt = count_stmt.where(Channel.is_active.is_(False))
        list_stmt = list_stmt.where(Channel.is_active.is_(False))

    total = int((await db.execute(count_stmt)).scalar() or 0)
    r = await db.execute(list_stmt.offset((page - 1) * page_size).limit(page_size))
    chans = r.scalars().all()
    return ChannelListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[ChannelRead.model_validate(c) for c in chans],
    )


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

    mod = _normalize_module(payload.module)

    alt_urls = payload.alternate_urls or []
    clean_alts = [str(url).strip() for url in alt_urls if str(url).strip() and str(url).strip() != str(payload.stream_url)]
    alt_json = _json.dumps(clean_alts) if clean_alts else None

    channel = Channel(
        name=payload.name.strip(),
        country=payload.country.strip(),
        category=payload.category.strip(),
        language=payload.language.strip(),
        logo_url=str(payload.logo_url) if payload.logo_url else None,
        stream_url=str(payload.stream_url),
        alternate_urls=alt_json,
        quality_tag=payload.quality_tag.strip().lower(),
        module=mod,
        header_profile=payload.header_profile.strip() if payload.header_profile else None,
        geo_hint=payload.geo_hint,
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
        if field == "module" and value is not None:
            channel.module = _normalize_module(str(value))
        elif field in {"logo_url", "stream_url"} and value is not None:
            setattr(channel, field, str(value))
        elif field == "alternate_urls" and value is not None:
            setattr(channel, field, _json.dumps([str(url).strip() for url in value if str(url).strip()]))
        elif field == "header_profile":
            channel.header_profile = str(value).strip() if value else None
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


# ─── M3U8 Playlist Import ─────────────────────────────────────


class PlaylistImportRequest(BaseModel):
    """Import M3U8 playlist."""
    name: str
    content: str
    module: str = "global_sports"


@router.post("/playlists/import", response_model=dict)
async def import_playlist(
    payload: PlaylistImportRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> dict:
    """Import channels from M3U8 content."""
    result = await import_m3u8_from_content(
        db=db,
        name=payload.name,
        content=payload.content,
        source_type="m3u8_file",
        module_default=payload.module,
    )
    if result.get("success"):
        invalidate_list_caches()
    return result


@router.get("/playlists", response_model=list[dict])
async def list_playlists(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> list[dict]:
    """List all imported playlists."""
    return await get_playlists(db)


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


# ─── User Management ───────────────────────────────────────────────────


@router.get("/users", response_model=dict[str, int | list])
async def admin_list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> dict[str, int | list]:
    """List all users with pagination."""
    total = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    stmt = (
        select(User)
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).scalars().all()
    items = [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "is_admin": u.is_admin,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "updated_at": u.updated_at.isoformat() if u.updated_at else None,
        }
        for u in rows
    ]
    return {"total": total, "items": items, "page": page, "page_size": page_size}


@router.get("/users/{user_id}")
async def admin_get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> dict:
    """Get user details."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "is_admin": user.is_admin,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


@router.put("/users/{user_id}")
async def admin_update_user(
    user_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> dict:
    """Update user (full_name, is_admin)."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if "full_name" in payload:
        user.full_name = str(payload["full_name"]).strip()
    if "is_admin" in payload:
        user.is_admin = bool(payload["is_admin"])

    await db.commit()
    await db.refresh(user)
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "is_admin": user.is_admin,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
) -> None:
    """Delete user (cannot delete yourself)."""
    if user_id == admin_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account.")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    await db.delete(user)
    await db.commit()


# ─── Bulk Channel Operations ───────────────────────────────────────────


@router.post("/channels/bulk-update-status")
async def admin_bulk_update_status(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> dict[str, int]:
    """Bulk update channel status (is_active) by IDs."""
    channel_ids = payload.get("ids", [])
    is_active = payload.get("is_active", False)

    if not channel_ids:
        raise HTTPException(status_code=400, detail="No channel IDs provided.")

    stmt = (
        select(Channel)
        .where(Channel.id.in_(channel_ids))
    )
    rows = (await db.execute(stmt)).scalars().all()

    if not rows:
        raise HTTPException(status_code=404, detail="No channels found.")

    for ch in rows:
        ch.is_active = bool(is_active)

    await db.commit()
    invalidate_list_caches()
    return {"updated": len(rows)}


@router.post("/channels/bulk-delete")
async def admin_bulk_delete(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> dict[str, int]:
    """Bulk delete channels by IDs."""
    channel_ids = payload.get("ids", [])

    if not channel_ids:
        raise HTTPException(status_code=400, detail="No channel IDs provided.")

    stmt = delete(Channel).where(Channel.id.in_(channel_ids))
    result = await db.execute(stmt)
    await db.commit()
    invalidate_list_caches()
    return {"deleted": result.rowcount or 0}


@router.post("/channels/bulk-update-module")
async def admin_bulk_update_module(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> dict[str, int]:
    """Bulk update channel module by IDs."""
    channel_ids = payload.get("ids", [])
    module = payload.get("module", "global_sports")

    if not channel_ids:
        raise HTTPException(status_code=400, detail="No channel IDs provided.")

    stmt = (
        select(Channel)
        .where(Channel.id.in_(channel_ids))
    )
    rows = (await db.execute(stmt)).scalars().all()

    if not rows:
        raise HTTPException(status_code=404, detail="No channels found.")

    for ch in rows:
        ch.module = str(module).strip()

    await db.commit()
    invalidate_list_caches()
    return {"updated": len(rows)}
