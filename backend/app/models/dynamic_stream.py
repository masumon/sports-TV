from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class DynamicStream(Base):
    """
    Stores dynamic HLS streams that require Playwright-based token extraction.

    Each record represents a streaming page whose .m3u8 URL is protected by
    expiring tokens.  A background scheduler re-extracts the URL before the
    token expires (at T-15 minutes).

    - ``source_page_url``  : the web page Playwright navigates to in order to
                             capture the .m3u8 network request.
    - ``m3u8_url``         : the most recently extracted .m3u8 URL.
    - ``headers_json``     : JSON-encoded dict of headers required to fetch
                             the stream (Referer, Origin, User-Agent, etc.).
    - ``expires_at``       : estimated token expiry; scheduler refreshes at
                             expires_at - 15 minutes.
    - ``fallback_m3u8_url``: the previous valid URL, served when the refresh
                             fails so the stream is never interrupted.
    - ``fallback_headers_json``: headers paired with the fallback URL.
    - ``token_ttl_seconds``: estimated token lifetime used to compute
                             ``expires_at`` after each extraction.
    - ``is_active``        : soft-delete flag; inactive records are skipped by
                             the refresh scheduler.
    - ``last_refreshed_at``: wall-clock time of the last successful extraction.
    """

    __tablename__ = "dynamic_streams"
    __table_args__ = (
        UniqueConstraint("source_page_url", name="uq_dynamic_streams_source_page_url"),
        Index("ix_dynamic_streams_active_expires", "is_active", "expires_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    source_page_url: Mapped[str] = mapped_column(Text, nullable=False)
    m3u8_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    headers_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fallback_m3u8_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    fallback_headers_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_ttl_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=3600)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    last_refreshed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
