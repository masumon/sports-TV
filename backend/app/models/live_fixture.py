from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class LiveFixture(Base):
    """
    Real fixture rows from public sports APIs (no fabricated events).
    Broadcast channel links are heuristic name-matches against our channel catalog, not rights data.
    """

    __tablename__ = "live_fixtures"
    __table_args__ = (
        UniqueConstraint("source", "external_id", name="uq_live_fixtures_source_ext"),
        Index("ix_live_fixtures_starts_status", "starts_at_utc", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(96), nullable=False)
    competition_key: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    league_name: Mapped[str] = mapped_column(String(240), nullable=False, default="")
    home_team: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    away_team: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    sport: Mapped[str] = mapped_column(String(48), nullable=False, default="Soccer")
    starts_at_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    score_text: Mapped[str | None] = mapped_column(String(96), nullable=True)
    thumb_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_channel_ids: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # JSON list of integer channel PKs
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
