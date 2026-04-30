from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.channel import ChannelRead


class LiveFixtureRead(BaseModel):
    """HATEOS-free fixture with optional catalog suggestions."""

    id: int
    source: str
    external_id: str
    competition_key: str | None
    league_name: str
    home_team: str
    away_team: str
    sport: str
    starts_at_utc: datetime
    status: str
    thumb_url: str | None
    data_attribution: str = Field(
        default="",
        description="Plain-text credit for the schedule API (shown in UI).",
    )
    suggested_channels: list[ChannelRead] = Field(default_factory=list)

    model_config = ConfigDict()


class LiveFixtureListResponse(BaseModel):
    items: list[LiveFixtureRead]
    updated_hint: datetime | None = Field(
        default=None, description="Latest fixture row updated_at if any (sync freshness)."
    )
