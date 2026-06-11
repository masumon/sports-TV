"""
User feedback collection endpoint.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

logger = logging.getLogger("app.feedback")

router = APIRouter(prefix="/feedback", tags=["feedback"])

# In-memory feedback storage (production should use database + email)
_feedback_log: list[dict] = []

@router.post("")
async def submit_feedback(
    message: str,
    userAgent: str = "",
    timestamp: str = "",
) -> dict[str, str]:
    """
    Collect user feedback.
    In production, store in database and/or send email notification.
    """
    if not message or not message.strip():
        raise HTTPException(status_code=400, detail="Feedback message required")

    if len(message) > 500:
        raise HTTPException(status_code=400, detail="Feedback too long (max 500 chars)")

    feedback_entry = {
        "message": message.strip(),
        "userAgent": userAgent[:200],  # Truncate user agent
        "timestamp": timestamp,
        "receivedAt": datetime.now(tz=timezone.utc).isoformat(),
    }

    # Log feedback (production: send to Slack, email, or database)
    logger.info(
        "User feedback received: %s | User-Agent: %s",
        message[:100],
        userAgent[:50],
    )

    # Store in memory (with size limit to prevent memory bloat)
    _feedback_log.append(feedback_entry)
    if len(_feedback_log) > 1000:  # Keep last 1000 feedbacks
        _feedback_log.pop(0)

    return {
        "status": "success",
        "message": "Feedback received. Thank you!",
    }

@router.get("/stats")
async def feedback_stats() -> dict:
    """Feedback statistics (admin only in production)."""
    return {
        "total_feedback": len(_feedback_log),
        "recent": _feedback_log[-5:] if _feedback_log else [],
    }
