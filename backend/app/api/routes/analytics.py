"""
Lightweight admin insights analytics.

Public endpoint: POST /analytics/event   — fire-and-forget event ingestion
Admin endpoint:  GET  /admin/analytics/summary — aggregated widgets
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_admin_user
from app.db.session import get_db
from app.models.analytics_event import AnalyticsEvent
from app.models.user import User

router = APIRouter(tags=["analytics"])

_VALID_EVENT_TYPES = frozenset({
    "APP_OPEN", "CHANNEL_OPEN", "PLAYBACK_START", "PLAYBACK_SUCCESS",
    "PLAYBACK_FAIL", "SERVER_SWITCH", "QUALITY_CHANGE", "SEARCH",
    "SEARCH_NO_RESULT", "PLAYER_ERROR", "QUICK_EXIT",
    "WATCH_DURATION", "BUFFER_STALL", "SEARCH_PLAY", "TAB_SWITCH",
})


class EventBody(BaseModel):
    event_type: str = Field(..., max_length=40)
    channel_id: Optional[int] = None
    channel_name: Optional[str] = Field(None, max_length=255)
    value: Optional[float] = None
    meta: Optional[str] = Field(None, max_length=512)


@router.post("/analytics/event", status_code=204, include_in_schema=False)
async def ingest_event(
    body: EventBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Fire-and-forget event ingestion. No auth — lightweight write."""
    if body.event_type not in _VALID_EVENT_TYPES:
        return  # silently drop unknown events

    db.add(AnalyticsEvent(
        event_type=body.event_type,
        channel_id=body.channel_id,
        channel_name=body.channel_name,
        value=body.value,
        meta=body.meta,
    ))
    await db.commit()

    # Prune events older than 7 days ~1% of inserts (free-tier storage guard)
    if random.random() < 0.01:
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        await db.execute(delete(AnalyticsEvent).where(AnalyticsEvent.created_at < cutoff))
        await db.commit()


@router.get("/admin/analytics/summary")
async def analytics_summary(
    hours: int = Query(default=24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> dict:
    """Admin-only: return all 5 insight widget datasets for the last N hours."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    # 1. Playback stats
    pb_rows = (await db.execute(
        select(AnalyticsEvent.event_type, func.count().label("cnt"))
        .where(AnalyticsEvent.event_type.in_(["PLAYBACK_START", "PLAYBACK_SUCCESS", "PLAYBACK_FAIL"]))
        .where(AnalyticsEvent.created_at >= since)
        .group_by(AnalyticsEvent.event_type)
    )).all()
    playback = {r.event_type: r.cnt for r in pb_rows}

    # 2. Top failed channels
    failed_rows = (await db.execute(
        select(
            AnalyticsEvent.channel_id, AnalyticsEvent.channel_name,
            func.count().label("cnt"),
            func.max(AnalyticsEvent.created_at).label("last_at"),
        )
        .where(AnalyticsEvent.event_type == "PLAYBACK_FAIL")
        .where(AnalyticsEvent.created_at >= since)
        .where(AnalyticsEvent.channel_id.isnot(None))
        .group_by(AnalyticsEvent.channel_id, AnalyticsEvent.channel_name)
        .order_by(desc("cnt"))
        .limit(10)
    )).all()

    # 3. Most watched channels
    watched_rows = (await db.execute(
        select(
            AnalyticsEvent.channel_id, AnalyticsEvent.channel_name,
            func.count().label("cnt"),
        )
        .where(AnalyticsEvent.event_type == "PLAYBACK_SUCCESS")
        .where(AnalyticsEvent.created_at >= since)
        .where(AnalyticsEvent.channel_id.isnot(None))
        .group_by(AnalyticsEvent.channel_id, AnalyticsEvent.channel_name)
        .order_by(desc("cnt"))
        .limit(10)
    )).all()

    # 4. Searches with no results
    search_rows = (await db.execute(
        select(AnalyticsEvent.meta, func.count().label("cnt"))
        .where(AnalyticsEvent.event_type == "SEARCH_NO_RESULT")
        .where(AnalyticsEvent.created_at >= since)
        .where(AnalyticsEvent.meta.isnot(None))
        .group_by(AnalyticsEvent.meta)
        .order_by(desc("cnt"))
        .limit(20)
    )).all()

    # 5. Quick exits (< 10 seconds)
    exit_rows = (await db.execute(
        select(
            AnalyticsEvent.channel_id, AnalyticsEvent.channel_name,
            func.count().label("cnt"),
        )
        .where(AnalyticsEvent.event_type == "QUICK_EXIT")
        .where(AnalyticsEvent.created_at >= since)
        .where(AnalyticsEvent.channel_id.isnot(None))
        .group_by(AnalyticsEvent.channel_id, AnalyticsEvent.channel_name)
        .order_by(desc("cnt"))
        .limit(10)
    )).all()

    # 6. Watch duration per channel
    wd_rows = (await db.execute(
        select(
            AnalyticsEvent.channel_id, AnalyticsEvent.channel_name,
            func.avg(AnalyticsEvent.value).label("avg_secs"),
            func.sum(AnalyticsEvent.value).label("total_secs"),
        )
        .where(AnalyticsEvent.event_type == "WATCH_DURATION")
        .where(AnalyticsEvent.created_at >= since)
        .where(AnalyticsEvent.channel_id.isnot(None))
        .where(AnalyticsEvent.value.isnot(None))
        .group_by(AnalyticsEvent.channel_id, AnalyticsEvent.channel_name)
        .order_by(desc("total_secs"))
        .limit(10)
    )).all()

    avg_watch_secs = (await db.execute(
        select(func.avg(AnalyticsEvent.value))
        .where(AnalyticsEvent.event_type == "WATCH_DURATION")
        .where(AnalyticsEvent.created_at >= since)
        .where(AnalyticsEvent.value.isnot(None))
    )).scalar() or 0.0

    # 7. Buffer stalls per channel
    stall_rows = (await db.execute(
        select(
            AnalyticsEvent.channel_id, AnalyticsEvent.channel_name,
            func.count().label("cnt"),
        )
        .where(AnalyticsEvent.event_type == "BUFFER_STALL")
        .where(AnalyticsEvent.created_at >= since)
        .where(AnalyticsEvent.channel_id.isnot(None))
        .group_by(AnalyticsEvent.channel_id, AnalyticsEvent.channel_name)
        .order_by(desc("cnt"))
        .limit(10)
    )).all()

    total_stalls = (await db.execute(
        select(func.count())
        .where(AnalyticsEvent.event_type == "BUFFER_STALL")
        .where(AnalyticsEvent.created_at >= since)
    )).scalar() or 0

    # 8. Error type breakdown
    error_type_rows = (await db.execute(
        select(AnalyticsEvent.meta, func.count().label("cnt"))
        .where(AnalyticsEvent.event_type.in_(["PLAYER_ERROR", "PLAYBACK_FAIL"]))
        .where(AnalyticsEvent.created_at >= since)
        .where(AnalyticsEvent.meta.isnot(None))
        .group_by(AnalyticsEvent.meta)
        .order_by(desc("cnt"))
    )).all()

    # 9. Search → play conversion
    search_total = (await db.execute(
        select(func.count())
        .where(AnalyticsEvent.event_type == "SEARCH")
        .where(AnalyticsEvent.created_at >= since)
    )).scalar() or 0

    search_plays = (await db.execute(
        select(func.count())
        .where(AnalyticsEvent.event_type == "SEARCH_PLAY")
        .where(AnalyticsEvent.created_at >= since)
    )).scalar() or 0

    # 10. Tab engagement
    tab_rows = (await db.execute(
        select(AnalyticsEvent.meta, func.count().label("cnt"))
        .where(AnalyticsEvent.event_type == "TAB_SWITCH")
        .where(AnalyticsEvent.created_at >= since)
        .where(AnalyticsEvent.meta.isnot(None))
        .group_by(AnalyticsEvent.meta)
        .order_by(desc("cnt"))
    )).all()

    # 11. Failover depth (SERVER_SWITCH grouped by server index)
    failover_rows = (await db.execute(
        select(AnalyticsEvent.value, func.count().label("cnt"))
        .where(AnalyticsEvent.event_type == "SERVER_SWITCH")
        .where(AnalyticsEvent.created_at >= since)
        .group_by(AnalyticsEvent.value)
        .order_by(AnalyticsEvent.value)
    )).all()

    # 12. Peak hour heatmap (all event types grouped by UTC hour)
    hour_rows = (await db.execute(
        select(
            func.extract("hour", AnalyticsEvent.created_at).label("hr"),
            func.count().label("cnt"),
        )
        .where(AnalyticsEvent.created_at >= since)
        .group_by("hr")
        .order_by("hr")
    )).all()

    attempts = playback.get("PLAYBACK_START", 0)
    successes = playback.get("PLAYBACK_SUCCESS", 0)
    failures = playback.get("PLAYBACK_FAIL", 0)
    success_pct = round(successes / attempts * 100, 1) if attempts else 0

    total_failovers = sum(r.cnt for r in failover_rows if (r.value or 0) > 0)
    stall_rate = round(total_stalls / attempts * 100, 1) if attempts else 0.0
    search_conv_pct = round(search_plays / search_total * 100, 1) if search_total else 0.0
    failover_pct = round(total_failovers / attempts * 100, 1) if attempts else 0.0

    return {
        "hours": hours,
        "playback": {
            "attempts": attempts,
            "successes": successes,
            "failures": failures,
            "success_pct": success_pct,
        },
        "top_failed": [
            {
                "channel_id": r.channel_id,
                "channel_name": r.channel_name or "Unknown",
                "fail_count": r.cnt,
                "last_failure": r.last_at.isoformat() if r.last_at else None,
            }
            for r in failed_rows
        ],
        "most_watched": [
            {
                "channel_id": r.channel_id,
                "channel_name": r.channel_name or "Unknown",
                "views": r.cnt,
            }
            for r in watched_rows
        ],
        "search_no_results": [
            {"term": r.meta, "count": r.cnt} for r in search_rows
        ],
        "quick_exits": [
            {
                "channel_id": r.channel_id,
                "channel_name": r.channel_name or "Unknown",
                "exit_count": r.cnt,
            }
            for r in exit_rows
        ],
        "watch_duration": {
            "avg_secs": round(float(avg_watch_secs), 1),
            "top_channels": [
                {
                    "channel_id": r.channel_id,
                    "channel_name": r.channel_name or "Unknown",
                    "avg_secs": round(float(r.avg_secs or 0), 1),
                    "total_secs": int(r.total_secs or 0),
                }
                for r in wd_rows
            ],
        },
        "buffer_stalls": {
            "total": total_stalls,
            "stall_rate_pct": stall_rate,
            "top_channels": [
                {
                    "channel_id": r.channel_id,
                    "channel_name": r.channel_name or "Unknown",
                    "stall_count": r.cnt,
                }
                for r in stall_rows
            ],
        },
        "error_types": [
            {"type": r.meta, "count": r.cnt} for r in error_type_rows
        ],
        "search_conversion": {
            "searches": search_total,
            "plays": search_plays,
            "conversion_pct": search_conv_pct,
        },
        "tab_engagement": [
            {"module": r.meta, "switches": r.cnt} for r in tab_rows
        ],
        "failover_depth": {
            "failover_pct": failover_pct,
            "servers": [
                {"server_idx": int(r.value or 0), "count": r.cnt}
                for r in failover_rows
            ],
        },
        "peak_hours": [
            {"hour": int(r.hr), "events": r.cnt} for r in hour_rows
        ],
    }
