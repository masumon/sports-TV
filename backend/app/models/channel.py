from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Channel(Base):
    __tablename__ = "channels"
    __table_args__ = (UniqueConstraint("stream_url", name="uq_channels_stream_url"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    country: Mapped[str] = mapped_column(String(120), nullable=False, default="Global", index=True)
    category: Mapped[str] = mapped_column(String(120), nullable=False, default="Sports", index=True)
    language: Mapped[str] = mapped_column(String(120), nullable=False, default="Unknown", index=True)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    stream_url: Mapped[str] = mapped_column(Text, nullable=False)
    alternate_urls: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array of backup stream URLs
    quality_tag: Mapped[str] = mapped_column(String(40), nullable=False, default="auto")
    source: Mapped[str] = mapped_column(String(80), nullable=False, default="manual")
    module: Mapped[str] = mapped_column(String(40), nullable=False, default="sports", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
