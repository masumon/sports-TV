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

    attempts = playback.get("PLAYBACK_START", 0)
    successes = playback.get("PLAYBACK_SUCCESS", 0)
    failures = playback.get("PLAYBACK_FAIL", 0)
    success_pct = round(successes / attempts * 100, 1) if attempts else 0

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
    }
