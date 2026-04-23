from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.channel import Channel
from app.schemas.channel import ChannelListResponse, ChannelRead

router = APIRouter(prefix="/sports-tv", tags=["sports-tv"])


@router.get("/channels", response_model=ChannelListResponse)
def list_channels(
    search: str | None = Query(default=None, min_length=1, max_length=120),
    country: str | None = Query(default=None, min_length=2, max_length=120),
    category: str | None = Query(default=None, min_length=2, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=100),
    db: Session = Depends(get_db),
) -> ChannelListResponse:
    base_query = select(Channel).where(Channel.is_active.is_(True))

    if search:
        base_query = base_query.where(Channel.name.ilike(f"%{search}%"))
    if country:
        base_query = base_query.where(Channel.country.ilike(country))
    if category:
        base_query = base_query.where(Channel.category.ilike(category))

    total = db.scalar(select(func.count()).select_from(base_query.subquery())) or 0

    channels = list(
        db.scalars(
            base_query.order_by(Channel.updated_at.desc(), Channel.name.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )

    return ChannelListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[ChannelRead.model_validate(channel) for channel in channels],
    )


@router.get("/channels/{channel_id}", response_model=ChannelRead)
def get_channel(channel_id: int, db: Session = Depends(get_db)) -> ChannelRead:
    channel = db.get(Channel, channel_id)
    if channel is None or not channel.is_active:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    return ChannelRead.model_validate(channel)
