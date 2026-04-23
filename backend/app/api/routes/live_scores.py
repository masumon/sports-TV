from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.match_stats import MatchStats, SportType
from app.schemas.match_stats import MatchStatsRead

router = APIRouter(prefix="/live-scores", tags=["Live Scores"])


@router.get("", response_model=list[MatchStatsRead])
def get_live_scores(
    sport_type: str | None = Query(default=None, description="football or cricket"),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[MatchStats]:
    query = select(MatchStats).order_by(MatchStats.updated_at.desc()).limit(limit)
    if sport_type:
        normalized = sport_type.lower()
        if normalized in {SportType.cricket.value, SportType.football.value}:
            query = query.where(MatchStats.sport_type == SportType(normalized))
    scores = list(db.scalars(query).all())
    return [MatchStatsRead.model_validate(score) for score in scores]
