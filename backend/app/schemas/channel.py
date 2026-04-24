import json
from datetime import datetime

from pydantic import AnyUrl, BaseModel, ConfigDict, Field, field_validator


class ChannelBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    country: str = Field(default="Global", min_length=2, max_length=120)
    category: str = Field(default="Sports", min_length=2, max_length=120)
    language: str = Field(default="Unknown", min_length=2, max_length=120)
    # Use str so non-HTTP protocols (rtmp://, udp://, rtp://) from IPTV sources are accepted.
    logo_url: str | None = None
    stream_url: str
    quality_tag: str = Field(default="auto", max_length=40)
    module: str = Field(default="sports", max_length=40)
    is_active: bool = True


class ChannelCreate(BaseModel):
    """Write schema — validates URLs are well-formed before storage."""
    name: str = Field(min_length=2, max_length=255)
    country: str = Field(default="Global", min_length=2, max_length=120)
    category: str = Field(default="Sports", min_length=2, max_length=120)
    language: str = Field(default="Unknown", min_length=2, max_length=120)
    logo_url: AnyUrl | None = None
    stream_url: AnyUrl
    quality_tag: str = Field(default="auto", max_length=40)
    module: str = Field(default="sports", max_length=40)
    is_active: bool = True


class ChannelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    country: str | None = Field(default=None, min_length=2, max_length=120)
    category: str | None = Field(default=None, min_length=2, max_length=120)
    language: str | None = Field(default=None, min_length=2, max_length=120)
    logo_url: AnyUrl | None = None
    stream_url: AnyUrl | None = None
    quality_tag: str | None = Field(default=None, max_length=40)
    module: str | None = Field(default=None, max_length=40)
    alternate_urls: list[str] | None = None
    is_active: bool | None = None


class ChannelRead(ChannelBase):
    id: int
    alternate_urls: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @field_validator("alternate_urls", mode="before")
    @classmethod
    def parse_alternate_urls(cls, v: object) -> list[str]:
        if isinstance(v, list):
            return v
        if isinstance(v, str) and v:
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(u) for u in parsed]
            except Exception:
                pass
        return []

    model_config = ConfigDict(from_attributes=True)


class ChannelListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[ChannelRead]


class ChannelFiltersResponse(BaseModel):
    countries: list[str]
    categories: list[str]
    languages: list[str]
    modules: list[str]
