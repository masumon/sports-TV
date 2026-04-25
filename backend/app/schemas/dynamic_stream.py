from __future__ import annotations

import json
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class DynamicStreamBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    source_page_url: str = Field(min_length=7, max_length=2048)
    token_ttl_seconds: int = Field(default=3600, ge=60, le=86400)
    is_active: bool = True


class DynamicStreamCreate(DynamicStreamBase):
    """Schema for creating a new DynamicStream entry via the admin API."""


class DynamicStreamUpdate(BaseModel):
    """Schema for partial updates; all fields optional."""
    name: str | None = Field(default=None, min_length=2, max_length=255)
    source_page_url: str | None = Field(default=None, min_length=7, max_length=2048)
    token_ttl_seconds: int | None = Field(default=None, ge=60, le=86400)
    is_active: bool | None = None


class DynamicStreamRead(DynamicStreamBase):
    id: int
    m3u8_url: str | None = None
    headers: dict[str, str] = Field(default_factory=dict)
    expires_at: datetime | None = None
    fallback_m3u8_url: str | None = None
    last_refreshed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def _map_headers_json(cls, data: object) -> object:
        """Rename ORM attribute 'headers_json' → 'headers' before field validation."""
        if hasattr(data, "__table__"):
            # SQLAlchemy ORM model — extract column values into a plain dict.
            row: dict[str, object] = {
                col.name: getattr(data, col.name)
                for col in data.__table__.columns  # type: ignore[union-attr]
            }
            row["headers"] = row.pop("headers_json", None)
            return row
        if isinstance(data, dict) and "headers_json" in data and "headers" not in data:
            data = dict(data)
            data["headers"] = data.pop("headers_json")
        return data

    @field_validator("headers", mode="before")
    @classmethod
    def _parse_headers(cls, v: object) -> dict[str, str]:
        if isinstance(v, dict):
            return {str(k): str(val) for k, val in v.items()}
        if isinstance(v, str) and v:
            try:
                parsed = json.loads(v)
                if isinstance(parsed, dict):
                    return {str(k): str(val) for k, val in parsed.items()}
            except Exception:
                pass
        return {}
