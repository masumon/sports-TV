from __future__ import annotations

from pydantic import BaseModel


class AdminStatsResponse(BaseModel):
    users: int
    channels: int
    live_scores: int
    active_channels: int
    cache_ttl_seconds: int
    scheduled_sync_minutes: int
    last_sync_at: str | None = None
