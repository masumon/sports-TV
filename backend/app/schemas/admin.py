from __future__ import annotations

from pydantic import BaseModel, Field


class AdminStatsResponse(BaseModel):
    users: int
    channels: int          # total rows in DB (active + inactive)
    active_channels: int   # is_active=True
    inactive_channels: int = 0  # is_active=False (deactivated / dead links)
    cache_ttl_seconds: int
    scheduled_sync_minutes: int
    last_sync_at: str | None = None
    last_sync_status: str | None = None
    last_sync_error: str | None = None
    # Last sync result counts
    last_sync_created: int = 0
    last_sync_updated: int = 0
    # Health sweep stats
    last_sweep_at: str | None = None
    last_sweep_checked: int = 0
    last_sweep_deactivated: int = 0


class StreamProbeRequest(BaseModel):
    """Batch stream URL availability checks (admin-only). Max size protects free-tier hosts."""

    urls: list[str] = Field(..., min_length=1, max_length=50)


class StreamProbeItemResult(BaseModel):
    url: str
    status: str  # alive | geo_blocked | dead
    http_status: int | None = None
    cached: bool = False


class StreamProbeResponse(BaseModel):
    results: list[StreamProbeItemResult]


class HealthSweepResponse(BaseModel):
    checked: int
    deactivated: int
    duration_seconds: float | None = None
