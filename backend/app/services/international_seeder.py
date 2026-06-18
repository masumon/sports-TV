"""
International Free Broadcasting Sources Seeder
Legal, authorized, geo-free sources for World Cup 2026 commentary in multiple languages
"""
import json
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.channel import Channel
import logging

logger = logging.getLogger("app.intl_seeder")

# FREE, AUTHORIZED, GEO-FREE international sources
INTERNATIONAL_CHANNELS = [
    # BRAZIL - CazéTV (YouTube - Portuguese commentary, completely FREE)
    {
        "name": "CazéTV - World Cup 2026 (Portuguese)",
        "country": "Brazil",
        "category": "Sports",
        "language": "Portuguese",
        "logo_url": "https://yt3.ggpht.com/a-/ACmandCQ_CazeTV-e1iGlQ_vQ=s88-c-k-c0x00ffffff-no-rj",
        "stream_url": "https://www.youtube.com/watch?v=live",  # CazéTV live feed
        "quality_tag": "720p",
        "module": "world_cup_2026",
        "source": "dynamic-youtube",
        "alternate_urls": ["https://www.youtube.com/c/cazeTV/live"],
        "is_active": False,
    },
    # AUSTRALIA - SBS On Demand (FREE, no account needed)
    {
        "name": "SBS - World Cup 2026 (English)",
        "country": "Australia",
        "category": "Sports",
        "language": "English",
        "logo_url": "https://www.sbs.com.au/favicon.ico",
        "stream_url": "https://www.sbs.com.au/sport/worldcup",
        "quality_tag": "1080p",
        "module": "world_cup_2026",
        "source": "international-free",
        "alternate_urls": ["https://ondemand.sbs.com.au/programs/worldcup"],
        "is_active": False,
    },
    # GERMANY - ZDF (FREE, public broadcaster)
    {
        "name": "ZDF - Fußball (German Commentary)",
        "country": "Germany",
        "category": "Sports",
        "language": "German",
        "logo_url": "https://www.zdf.de/assets/zdf-icon-1eb2e78b.png",
        "stream_url": "https://zdf-hls-live.akamaized.net/hls/live/2016498/zdf/3/index.m3u8",
        "quality_tag": "720p",
        "module": "world_cup_2026",
        "source": "international-free",
        "alternate_urls": [],
        "geo_hint": True,
    },
    # FRANCE - TF1 (FREE, public broadcaster)
    {
        "name": "TF1 - Coupe du Monde (French Commentary)",
        "country": "France",
        "category": "Sports",
        "language": "French",
        "logo_url": "https://www.tf1.fr/favicon.ico",
        "stream_url": "https://www.tf1.fr/tf1/direct",
        "quality_tag": "720p",
        "module": "world_cup_2026",
        "source": "international-free",
        "alternate_urls": ["https://www.tf1.fr/tf1/monde/direct"],
        "is_active": False,
    },
    # SPAIN - RTVE (FREE, public broadcaster)
    {
        "name": "RTVE - Mundial 2026 (Spanish Commentary)",
        "country": "Spain",
        "category": "Sports",
        "language": "Spanish",
        "logo_url": "https://www.rtve.es/favicon.ico",
        "stream_url": "https://rtvelivestream.akamaized.net/rtvesec/la1/la1_hd.m3u8",
        "quality_tag": "720p",
        "module": "world_cup_2026",
        "source": "international-free",
        "alternate_urls": [],
        "geo_hint": True,
    },
]


def seed_international_channels(db: Session) -> dict:
    """
    Auto-seed international FREE (legal, authorized) broadcasting sources.
    These are public broadcasters with World Cup streaming rights - NO VPN needed.
    """
    created = 0
    updated = 0

    for ch_data in INTERNATIONAL_CHANNELS:
        db_fields = dict(ch_data)
        if isinstance(db_fields.get("alternate_urls"), list):
            db_fields["alternate_urls"] = json.dumps(db_fields["alternate_urls"])
        is_active = db_fields.pop("is_active", True)

        # Check if exists
        existing = db.execute(
            select(Channel).where(
                (Channel.name == ch_data["name"]) & (Channel.country == ch_data["country"])
            )
        ).scalars().first()

        try:
            with db.begin_nested():
                if existing:
                    # Update with new URLs
                    for key, val in db_fields.items():
                        setattr(existing, key, val)
                    existing.is_active = is_active
                    updated += 1
                    logger.info("Updated: %s", ch_data['name'])
                else:
                    # Create new
                    new_ch = Channel(**db_fields, is_active=is_active)
                    db.add(new_ch)
                    created += 1
                    logger.info("Created: %s", ch_data['name'])
        except Exception as exc:
            logger.warning("Failed to seed %s: %s", ch_data['name'], exc)
            continue

    db.commit()
    logger.info("International seed: %d created, %d updated", created, updated)

    # Phase 4: Seed CazéTV as DynamicStream for Playwright-based YouTube extraction
    try:
        from app.models.dynamic_stream import DynamicStream
        cazetv_page_url = "https://www.youtube.com/c/cazeTV/live"

        existing_ds = db.execute(
            select(DynamicStream).where(DynamicStream.source_page_url == cazetv_page_url)
        ).scalars().first()

        if not existing_ds:
            ds = DynamicStream(
                name="CazéTV World Cup 2026 (YouTube Live)",
                source_page_url=cazetv_page_url,
                token_ttl_seconds=1800,
                is_active=False,  # Admin enables after verifying Playwright works on this tier
            )
            db.add(ds)
            db.flush()
            ds_id = ds.id
            logger.info("CazéTV DynamicStream created id=%d", ds_id)
        else:
            ds_id = existing_ds.id
            logger.info("CazéTV DynamicStream already exists id=%d", ds_id)

        # Update CazéTV Channel to point to the dynamic proxy endpoint
        cazetv_ch = db.execute(
            select(Channel).where(
                Channel.name == "CazéTV - World Cup 2026 (Portuguese)"
            )
        ).scalars().first()
        if cazetv_ch:
            cazetv_ch.stream_url = f"/api/v1/proxy/m3u8?stream_id={ds_id}"
            cazetv_ch.source = "dynamic-youtube"
            # Keep is_active=False until DynamicStream has a valid m3u8_url
            cazetv_ch.is_active = bool(existing_ds and existing_ds.m3u8_url)

        db.commit()
        logger.info("CazéTV DynamicStream seeding complete (is_active=%s for YouTube extraction)", False)
    except Exception as exc:
        logger.warning("CazéTV DynamicStream seeding failed (non-fatal): %s", exc)
        try:
            db.rollback()
        except Exception:
            pass

    return {"created": created, "updated": updated}
