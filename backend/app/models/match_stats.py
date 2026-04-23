from __future__ import annotations

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class SportType(str, PyEnum):
    cricket = "cricket"
    football = "football"


class MatchStatus(str, PyEnum):
    upcoming = "upcoming"
    live = "live"
    finished = "finished"


class MatchStats(Base):
    __tablename__ = "match_stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sport_type: Mapped[SportType] = mapped_column(
        Enum(SportType, name="sport_type_enum"), nullable=False, index=True
    )
    league: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    team_home: Mapped[str] = mapped_column(String(120), nullable=False)
    team_away: Mapped[str] = mapped_column(String(120), nullable=False)
    score_home: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    score_away: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    match_minute: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[MatchStatus] = mapped_column(
        Enum(MatchStatus, name="match_status_enum"), nullable=False, default=MatchStatus.live
    )
    extra_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
