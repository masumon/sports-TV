from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Playlist(Base):
    """M3U8 Playlist source - stores metadata about imported playlists."""
    __tablename__ = "playlists"
    __table_args__ = (
        Index("ix_playlists_active_updated", "is_active", "updated_at"),
        Index("ix_playlists_source", "source_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # M3U8 source info
    source_type: Mapped[str] = mapped_column(String(40), nullable=False)  # "m3u8_url", "m3u8_file", "toffee_api", "tsports_api"
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # Full M3U8 URL if applicable

    # Parsing & sync
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_status: Mapped[str] = mapped_column(String(40), nullable=False, default="pending")  # pending, success, failed
    last_sync_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    channel_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Settings
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    auto_sync: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)  # Auto-import new channels
    sync_interval_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=24)

    # Metadata
    module_default: Mapped[str] = mapped_column(String(40), nullable=False, default="global_sports")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
