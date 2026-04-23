from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SportLiteral = Literal["football", "cricket"]
StatusLiteral = Literal["upcoming", "live", "finished"]


class MatchStatsBase(BaseModel):
    sport_type: SportLiteral = "football"
    league: str = Field(min_length=2, max_length=120)
    team_home: str = Field(min_length=2, max_length=120)
    team_away: str = Field(min_length=2, max_length=120)
    score_home: int = Field(default=0, ge=0)
    score_away: int = Field(default=0, ge=0)
    match_minute: str | None = Field(default=None, max_length=50)
    status: StatusLiteral = "live"
    extra_data: str | None = Field(default=None, max_length=1000)


class MatchStatsCreate(MatchStatsBase):
    pass


class MatchStatsUpdate(BaseModel):
    sport_type: SportLiteral | None = None
    league: str | None = Field(default=None, min_length=2, max_length=120)
    team_home: str | None = Field(default=None, min_length=2, max_length=120)
    team_away: str | None = Field(default=None, min_length=2, max_length=120)
    score_home: int | None = Field(default=None, ge=0)
    score_away: int | None = Field(default=None, ge=0)
    match_minute: str | None = Field(default=None, max_length=50)
    status: StatusLiteral | None = None
    extra_data: str | None = Field(default=None, max_length=1000)


class MatchStatsRead(MatchStatsBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
