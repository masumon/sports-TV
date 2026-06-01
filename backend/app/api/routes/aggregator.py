"""
IPTV Aggregation API Routes

Endpoints:
  GET /api/v1/aggregator/jagobd
      Extract m3u8 URLs from a JagoBD page via regex (no Playwright).

  GET /api/v1/aggregator/bdix
      Deduplicated BDIX IPTV channel list (JSON).

  POST /api/v1/aggregator/bdix/sync
      Import BDIX channels into the DB. Admin-only.

  GET /api/v1/aggregator/channels.json
      Full channel export: id, name, logo, group, country, language,
      stream_url, proxy_url, headers, quality, is_live, source, epg_id.
"""
from __future__ import annotations

import json
import logging
import urllib.parse
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.db.session import get_db
from app.models.channel import Channel
from app.services.bdix_aggregator import BDIX_SOURCES, fetch_bdix_channels
from app.services.jagobd_extractor import JAGOBD_LIVE_URL, extract_jagobd

logger = logging.getLogger("app.aggregator")

router = APIRouter(prefix="/aggregator", tags=["aggregator"])

_CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
}
_NO_CACHE = {"Cache-Control": "no-store, no-cache, must-revalidate"}
_SHORT_CACHE = {"Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"}
_MEDIUM_CACHE = {"Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300"}

EPG_URL = "https://avkb.short.gy/epg.xml.gz"


def _proxy_stream_url(target: str, header_profile: str | None = None) -> str:
    base = f"{settings.api_v1_prefix}/proxy/stream?url={urllib.parse.quote(target, safe='')}"
    if header_profile:
        base += f"&header_profile={urllib.parse.quote(header_profile, safe='')}"
    return base


# ─────────────────────────────── JagoBD ───────────────────────────────────

@router.get("/jagobd", summary="Extract JagoBD stream URLs via regex")
async def jagobd_extract(
    page_url: str = Query(
        default=JAGOBD_LIVE_URL,
        description="JagoBD page to extract streams from",
        min_length=10,
        max_length=512,
    ),
) -> Response:
    """
    Lightweight JagoBD extractor: fetches page HTML and reconstructs
    obfuscated JS array-join URLs without browser automation.
    Falls back to direct src/file/url assignments.
    """
    if not page_url.startswith("https://jagobd.com"):
        raise HTTPException(
            status_code=400,
            detail="Only jagobd.com URLs are permitted",
        )

    result = await run_in_threadpool(extract_jagobd, page_url)

    body: dict[str, Any] = {
        "page_url": result.page_url,
        "m3u8_urls": result.m3u8_urls,
        "proxy_urls": [_proxy_stream_url(u) for u in result.m3u8_urls[:5]],
        "method": result.method,
        "count": len(result.m3u8_urls),
        "error": result.error,
        "note": (
            "If m3u8_urls is empty, the page uses complex JS execution. "
            "Use the DynamicStream Playwright pipeline (admin UI) for this channel."
        ) if not result.m3u8_urls else None,
    }
    headers = {**_CORS}
    if result.m3u8_urls:
        headers.update(_SHORT_CACHE)
    else:
        headers.update(_NO_CACHE)

    return Response(
        content=json.dumps(body, ensure_ascii=False),
        media_type="application/json",
        headers=headers,
    )


@router.options("/jagobd")
async def jagobd_preflight() -> Response:
    return Response(status_code=204, headers=_CORS)


# ──────────────────────────────── BDIX ────────────────────────────────────

@router.get("/bdix", summary="Fetch deduplicated BDIX IPTV channel list")
async def bdix_channels(
    limit: int = Query(default=500, ge=1, le=5000),
) -> Response:
    """
    Return a merged, deduplicated JSON list of BDIX IPTV channels
    from all configured BDIX sources.
    """
    channels = await run_in_threadpool(fetch_bdix_channels)

    body: dict[str, Any] = {
        "count": len(channels),
        "returned": min(len(channels), limit),
        "sources": BDIX_SOURCES,
        "updated_at": datetime.now(tz=timezone.utc).isoformat(),
        "channels": [
            {
                "name": ch.name,
                "stream_url": ch.stream_url,
                "proxy_url": _proxy_stream_url(ch.stream_url),
                "logo_url": ch.logo_url,
                "category": ch.category,
                "country": ch.country,
                "language": ch.language,
                "module": ch.module,
            }
            for ch in channels[:limit]
        ],
    }
    return Response(
        content=json.dumps(body, ensure_ascii=False),
        media_type="application/json",
        headers={**_CORS, **_MEDIUM_CACHE},
    )


@router.post("/bdix/sync", summary="Import BDIX channels into DB (admin)")
async def bdix_sync(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Fetch BDIX channels and upsert them into the channels table.
    Requires X-Sync-Secret header (same as /internal/sync).
    """
    import hmac as _hmac
    from starlette.concurrency import run_in_threadpool as _tp

    secret = (settings.__dict__.get("internal_sync_secret") or "").strip()
    if secret:
        provided = request.headers.get("X-Sync-Secret", "")
        if not _hmac.compare_digest(provided.encode(), secret.encode()):
            raise HTTPException(status_code=403, detail="Forbidden")

    channels = await run_in_threadpool(fetch_bdix_channels, None, True)
    if not channels:
        return Response(
            content=json.dumps({"status": "ok", "synced": 0, "message": "No BDIX channels fetched"}),
            media_type="application/json",
            headers=_CORS,
        )

    # Upsert via the existing scraper pipeline (sync context)
    from app.db.session import SessionLocal as _SL
    from app.services.iptv_scraper import sync_channels_from_entries as _sync

    def _do_sync() -> dict:
        with _SL() as sdb:
            return _sync(sdb, channels, source="bdix")

    result = await run_in_threadpool(_do_sync)
    body = {"status": "ok", "synced": len(channels), "db_result": result}
    return Response(
        content=json.dumps(body),
        media_type="application/json",
        headers=_CORS,
    )


@router.options("/bdix")
@router.options("/bdix/sync")
async def bdix_preflight() -> Response:
    return Response(status_code=204, headers=_CORS)


# ─────────────────────────── channels.json ────────────────────────────────

# Known EPG IDs for popular channels (extend as needed)
_EPG_ID_MAP: dict[str, str] = {
    "t sports": "1918",
    "t-sports": "1918",
    "tsports": "1918",
    "sony sports 1": "sony_sports_1",
    "sony sports 2": "sony_sports_2",
    "sony ten 1": "sony_ten_1",
    "sony ten 2": "sony_ten_2",
    "sony ten 3": "sony_ten_3",
    "star sports 1": "star_sports_1",
    "star sports 2": "star_sports_2",
    "star sports hd1": "star_sports_1",
    "willow": "willow",
    "espn": "espn",
    "espn2": "espn2",
    "sky sports f1": "skysf1",
    "sky sports cricket": "skyscricket",
    "sky sports main event": "skymain",
    "beinsports 1": "beinsports1",
    "beinsports 2": "beinsports2",
    "eurosport 1": "eurosport1",
    "eurosport 2": "eurosport2",
    "fox sports": "foxsports",
    "ten cricket": "tencricket",
    "ptv sports": "ptvsports",
    "geo super": "geosuper",
    "channel 24": "channel24bd",
    "somoy tv": "somoytv",
    "jamuna tv": "jamunatv",
    "rtv": "rtv",
    "atv": "atv",
    "ntn": "ntn",
    "dd sports": "ddsports",
    "star cricket": "starcricket",
    "redbull tv": "redbulltv",
    "red bull tv": "redbulltv",
}


def _lookup_epg_id(name: str) -> str | None:
    key = name.lower().strip()
    if key in _EPG_ID_MAP:
        return _EPG_ID_MAP[key]
    # Partial match
    for k, v in _EPG_ID_MAP.items():
        if k in key or key in k:
            return v
    return None


@router.get("/channels.json", summary="Full channel export as JSON")
async def channels_json(
    request: Request,
    limit: int = Query(default=2000, ge=1, le=10000),
    module: str | None = Query(default=None, description="Filter by module slug"),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Export all active channels as a structured JSON file.

    Fields: id, name, logo, group, country, language, stream_url,
            proxy_url, headers, quality, bitrate, is_live, source,
            last_checked, epg_id.

    Includes EPG header URL for playlist player integration.
    """
    cap = min(max(1, limit), 10000)

    try:
        q = select(Channel).where(Channel.is_active.is_(True))
        if module:
            q = q.where(Channel.module == module)
        q = q.order_by(Channel.updated_at.desc()).limit(cap)
        result = await db.execute(q)
        channels = result.scalars().all()
    except Exception as exc:
        logger.error("channels.json DB error: %s", exc)
        raise HTTPException(status_code=503, detail="Database unavailable") from exc

    base = str(request.base_url).rstrip("/")
    proxy_base = f"{base}{settings.api_v1_prefix}/proxy/stream"

    items: list[dict[str, Any]] = []
    for ch in channels:
        proxy_url = f"{proxy_base}?url={urllib.parse.quote(ch.stream_url, safe='')}"
        epg_id = _lookup_epg_id(ch.name)

        # Alternate URLs stored as JSON array string in DB
        alts: list[str] = []
        if ch.alternate_urls:
            try:
                alts = json.loads(ch.alternate_urls)
            except Exception:
                pass

        items.append({
            "id": ch.id,
            "name": ch.name,
            "logo": ch.logo_url,
            "group": ch.category,
            "country": ch.country,
            "language": ch.language,
            "stream_url": ch.stream_url,
            "proxy_url": proxy_url,
            "alternate_urls": alts,
            "headers": {},
            "quality": ch.quality_tag,
            "bitrate": None,
            "is_live": True,
            "source": ch.source,
            "module": ch.module,
            "last_checked": ch.updated_at.isoformat() if ch.updated_at else None,
            "epg_id": epg_id,
        })

    body = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "count": len(items),
        "epg_url": EPG_URL,
        "channels": items,
    }

    return Response(
        content=json.dumps(body, ensure_ascii=False, default=str),
        media_type="application/json",
        headers={
            **_CORS,
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
            "Content-Disposition": "inline; filename=channels.json",
        },
    )


@router.options("/channels.json")
async def channels_json_preflight() -> Response:
    return Response(status_code=204, headers=_CORS)
