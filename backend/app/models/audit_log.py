from __future__ import annotations

from datetime import datetime
from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AuditLog(Base):
    """Track playlist imports, edits, and admin actions."""
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    action: Mapped[str] = mapped_column(String(40), nullable=False)  # import, edit, delete, sync
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)  # playlist, channel
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    admin_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON summary
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
