from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_admin_user
from app.db.session import get_db
from app.models.channel import Channel
from app.models.match_stats import MatchStats, MatchStatus, SportType
from app.models.user import User
from app.schemas.channel import ChannelCreate, ChannelRead, ChannelUpdate
from app.schemas.match_stats import MatchStatsCreate, MatchStatsRead, MatchStatsUpdate
from app.services.iptv_scraper import scrape_and_sync_sports_channels

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/channels/sync", response_model=dict[str, int])
def sync_channels(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> dict[str, int]:
    return scrape_and_sync_sports_channels(db)


@router.get("/channels", response_model=list[ChannelRead])
def admin_list_channels(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> list[Channel]:
    stmt = select(Channel).order_by(Channel.updated_at.desc())
    return list(db.scalars(stmt).all())


@router.post("/channels", response_model=ChannelRead, status_code=status.HTTP_201_CREATED)
def admin_create_channel(
    payload: ChannelCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> Channel:
    exists = db.scalar(select(Channel).where(Channel.stream_url == str(payload.stream_url)))
    if exists:
        raise HTTPException(status_code=400, detail="Stream URL already exists.")

    channel = Channel(
        name=payload.name.strip(),
        country=payload.country.strip(),
        category=payload.category.strip(),
        language=payload.language.strip(),
        logo_url=str(payload.logo_url) if payload.logo_url else None,
        stream_url=str(payload.stream_url),
        quality_tag=payload.quality_tag.strip().lower(),
        is_active=payload.is_active,
        source="manual",
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return channel


@router.put("/channels/{channel_id}", response_model=ChannelRead)
def admin_update_channel(
    channel_id: int,
    payload: ChannelUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> Channel:
    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found.")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field in {"logo_url", "stream_url"} and value is not None:
            setattr(channel, field, str(value))
        else:
            setattr(channel, field, value)

    db.commit()
    db.refresh(channel)
    return channel


@router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_channel(
    channel_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> None:
    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found.")
    db.delete(channel)
    db.commit()


def _parse_sport(value: str) -> SportType:
    normalized = value.lower().strip()
    if normalized == "football":
        return SportType.football
    if normalized == "cricket":
        return SportType.cricket
    raise HTTPException(status_code=400, detail="sport_type must be football or cricket.")


def _parse_status(value: str) -> MatchStatus:
    normalized = value.lower().strip()
    if normalized == "live":
        return MatchStatus.live
    if normalized == "upcoming":
        return MatchStatus.upcoming
    if normalized == "finished":
        return MatchStatus.finished
    raise HTTPException(status_code=400, detail="status must be live, upcoming, or finished.")


@router.get("/scores", response_model=list[MatchStatsRead])
def admin_list_scores(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> list[MatchStats]:
    stmt = select(MatchStats).order_by(MatchStats.updated_at.desc())
    return list(db.scalars(stmt).all())


@router.post("/scores", response_model=MatchStatsRead, status_code=status.HTTP_201_CREATED)
def admin_create_score(
    payload: MatchStatsCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> MatchStats:
    score = MatchStats(
        sport_type=_parse_sport(payload.sport_type),
        league=payload.league,
        team_home=payload.team_home,
        team_away=payload.team_away,
        score_home=payload.score_home,
        score_away=payload.score_away,
        match_minute=payload.match_minute,
        status=_parse_status(payload.status),
        extra_data=payload.extra_data,
    )
    db.add(score)
    db.commit()
    db.refresh(score)
    return score


@router.put("/scores/{score_id}", response_model=MatchStatsRead)
def admin_update_score(
    score_id: int,
    payload: MatchStatsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> MatchStats:
    score = db.get(MatchStats, score_id)
    if not score:
        raise HTTPException(status_code=404, detail="Live score not found.")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field == "sport_type" and value is not None:
            score.sport_type = _parse_sport(value)
            continue
        if field == "status" and value is not None:
            score.status = _parse_status(value)
            continue
        setattr(score, field, value)

    db.commit()
    db.refresh(score)
    return score


@router.delete("/scores/{score_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_score(
    score_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
) -> None:
    score = db.get(MatchStats, score_id)
    if not score:
        raise HTTPException(status_code=404, detail="Live score not found.")
    db.delete(score)
    db.commit()
