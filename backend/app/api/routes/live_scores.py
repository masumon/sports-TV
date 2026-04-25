from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_get_json, cache_set_json
from app.core.config import settings
from app.db.session import get_db
from app.models.match_stats import MatchStats, SportType
from app.schemas.match_stats import MatchStatsRead

logger = logging.getLogger("app.live_scores")

router = APIRouter(prefix="/live-scores", tags=["Live Scores"])

LIVE_SCORE_CACHE_TTL = 30  # seconds — live data must be fresh
LIVE_CACHE_HEADER = f"public, s-maxage={LIVE_SCORE_CACHE_TTL}, stale-while-revalidate=10"


@router.get("", response_model=list[MatchStatsRead])
async def get_live_scores(
    response: Response,
    sport_type: str | None = Query(default=None, description="football or cricket"),
    limit: int = Query(default=10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[MatchStatsRead]:
    response.headers["Cache-Control"] = LIVE_CACHE_HEADER
    response.headers["Vary"] = "Accept-Encoding"
    params = {"sport_type": sport_type, "limit": limit}
    cached = cache_get_json("live-scores", params)
    if cached is not None:
        try:
            return [MatchStatsRead.model_validate(x) for x in cached]
        except Exception:
            logger.debug("live-scores cache miss parse")

    query = select(MatchStats).order_by(MatchStats.updated_at.desc()).limit(limit)
    if sport_type:
        normalized = sport_type.lower()
        if normalized in {SportType.cricket.value, SportType.football.value}:
            query = query.where(MatchStats.sport_type == SportType(normalized))
    result = await db.execute(query)
    scores = list(result.scalars().all())
    out = [MatchStatsRead.model_validate(score) for score in scores]
    try:
        cache_set_json("live-scores", params, [m.model_dump(mode="json") for m in out], ttl=LIVE_SCORE_CACHE_TTL)
    except Exception as e:
        logger.debug("cache set failed: %s", e)
    return out
