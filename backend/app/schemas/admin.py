from __future__ import annotations

from pydantic import BaseModel, Field


class AdminStatsResponse(BaseModel):
    users: int
    channels: int
    active_channels: int
    cache_ttl_seconds: int
    scheduled_sync_minutes: int
    last_sync_at: str | None = None
    last_sync_status: str | None = None
    last_sync_error: str | None = None


class StreamProbeRequest(BaseModel):
    """Batch stream URL availability checks (admin-only). Max size protects free-tier hosts."""

    urls: list[str] = Field(..., min_length=1, max_length=24)


class StreamProbeItemResult(BaseModel):
    url: str
    status: str  # alive | geo_blocked | dead
    http_status: int | None = None
    cached: bool = False


class StreamProbeResponse(BaseModel):
    results: list[StreamProbeItemResult]
