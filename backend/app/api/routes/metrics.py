"""
Streaming health metrics endpoint for monitoring.
Returns Prometheus-compatible metrics.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.sync_rate_limit import get_last_sync_iso, get_last_sync_status
from app.db.session import get_db
from app.models import Channel

router = APIRouter(prefix="/metrics", tags=["monitoring"])

# Simple in-memory counters (production should use Prometheus client library)
_metrics = {
    "stream_requests": 0,
    "stream_errors": 0,
    "stream_success": 0,
    "api_requests": 0,
    "api_errors": 0,
}

def increment_metric(key: str, amount: int = 1) -> None:
    """Thread-safe metric increment."""
    if key in _metrics:
        _metrics[key] += amount

@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)) -> dict:
    """Health check endpoint - used by Render, Vercel."""
    try:
        total_channels = await db.run_sync(
            lambda session: session.execute(
                "SELECT COUNT(*) as count FROM channels"
            ).scalar()
        )
        active_channels = await db.run_sync(
            lambda session: session.execute(
                "SELECT COUNT(*) as count FROM channels WHERE is_active = true"
            ).scalar()
        )
        return {
            "status": "healthy",
            "database": "connected",
            "channels_total": total_channels or 0,
            "channels_active": active_channels or 0,
            "last_sync": get_last_sync_iso(),
            "last_sync_status": get_last_sync_status(),
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "error",
            "error": str(e),
        }, 503

@router.get("/prometheus")
async def prometheus_metrics() -> str:
    """Prometheus-compatible metrics endpoint."""
    lines = [
        "# HELP stream_requests_total Total stream requests",
        "# TYPE stream_requests_total counter",
        f"stream_requests_total {_metrics['stream_requests']}",
        "",
        "# HELP stream_errors_total Total stream errors",
        "# TYPE stream_errors_total counter",
        f"stream_errors_total {_metrics['stream_errors']}",
        "",
        "# HELP stream_success_total Successful streams",
        "# TYPE stream_success_total counter",
        f"stream_success_total {_metrics['stream_success']}",
        "",
        "# HELP api_requests_total Total API requests",
        "# TYPE api_requests_total counter",
        f"api_requests_total {_metrics['api_requests']}",
        "",
        "# HELP api_errors_total API errors",
        "# TYPE api_errors_total counter",
        f"api_errors_total {_metrics['api_errors']}",
    ]
    return "\n".join(lines)

@router.get("/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)) -> dict:
    """Kubernetes/orchestration readiness check."""
    try:
        # Check database connection
        await db.execute("SELECT 1")
        return {"ready": True, "message": "API is ready for traffic"}
    except Exception as e:
        return {"ready": False, "message": f"API not ready: {e}"}, 503
