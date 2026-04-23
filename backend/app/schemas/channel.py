from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class ChannelBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    country: str = Field(default="Global", min_length=2, max_length=120)
    category: str = Field(default="Sports", min_length=2, max_length=120)
    language: str = Field(default="Unknown", min_length=2, max_length=120)
    logo_url: HttpUrl | None = None
    stream_url: HttpUrl
    quality_tag: str = Field(default="auto", max_length=40)
    is_active: bool = True


class ChannelCreate(ChannelBase):
    pass


class ChannelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    country: str | None = Field(default=None, min_length=2, max_length=120)
    category: str | None = Field(default=None, min_length=2, max_length=120)
    language: str | None = Field(default=None, min_length=2, max_length=120)
    logo_url: HttpUrl | None = None
    stream_url: HttpUrl | None = None
    quality_tag: str | None = Field(default=None, max_length=40)
    is_active: bool | None = None


class ChannelRead(ChannelBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChannelListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[ChannelRead]
