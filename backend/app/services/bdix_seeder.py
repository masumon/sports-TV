"""
BDIX Local CDN Seeder - Auto-import Bangladesh sports channels.
Provides trusted, persistent stream sources with no geo-blocking.
"""
import json
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.channel import Channel
from app.db.session import SessionLocal
import logging

logger = logging.getLogger("app.bdix_seeder")

BDIX_CHANNELS = [
    {
        "name": "BTV HD",
        "country": "Bangladesh",
        "category": "Sports",
        "language": "Bengali",
        "logo_url": "https://sunplex.net/iptv/logo/btv.jpg",
        "stream_url": "https://stream.sunplex.live/BTV/index.m3u8",
        "quality_tag": "auto",
        "module": "world_cup_2026",
        "source": "bdix-local",
        "geo_hint": True,
        "alternate_urls": ["http://103.55.144.46:80/hls/btv.m3u8"],
    },
    {
        "name": "T SPORTS HD",
        "country": "Bangladesh",
        "category": "Sports",
        "language": "Bengali",
        "logo_url": "https://sunplex.net/iptv/logo/t-sports-hd-fifa-2022.jpg",
        "stream_url": "https://stream.sunplex.live/T-SPORTS/index.m3u8",
        "quality_tag": "auto",
        "module": "world_cup_2026",
        "source": "bdix-local",
        "geo_hint": True,
        "alternate_urls": [
            "http://103.55.144.46:80/hls/t-sports.m3u8",
        ],
    },
    {
        "name": "SOMOY TV",
        "country": "Bangladesh",
        "category": "News/Entertainment",
        "language": "Bengali",
        "logo_url": "https://sunplex.net/iptv/logo/somoy-tv.jpg",
        "stream_url": "https://stream.sunplex.live/SOMOY-TV/index.m3u8",
        "quality_tag": "auto",
        "module": "world_cup_2026",
        "source": "bdix-local",
        "geo_hint": True,
        "alternate_urls": [],
    },
    {
        "name": "GAZI TV HD",
        "country": "Bangladesh",
        "category": "Sports",
        "language": "Bengali",
        "logo_url": "https://sunplex.net/iptv/logo/gtv-hd-fifa-2022.jpg",
        "stream_url": "https://stream.sunplex.live/GAZI-TV/index.m3u8",
        "quality_tag": "auto",
        "module": "world_cup_2026",
        "source": "bdix-local",
        "geo_hint": True,
        "alternate_urls": ["http://103.55.144.46:80/hls/Gazi-TV.m3u8"],
    },
]


def seed_bdix_channels(db: Session) -> dict:
    """
    Auto-seed BDIX local CDN channels.
    Upsert: create if new, update if exists.
    Returns: count of created/updated channels.
    """
    created = 0
    updated = 0

    for ch_data in BDIX_CHANNELS:
        db_fields = dict(ch_data)
        if isinstance(db_fields.get("alternate_urls"), list):
            db_fields["alternate_urls"] = json.dumps(db_fields["alternate_urls"])

        # Check if exists
        existing = db.execute(
            select(Channel).where(
                (Channel.name == ch_data["name"]) & (Channel.country == ch_data["country"])
            )
        ).scalars().first()

        try:
            with db.begin_nested():
                if existing:
                    for key, val in db_fields.items():
                        setattr(existing, key, val)
                    existing.is_active = True
                    updated += 1
                    logger.info("Updated: %s", ch_data['name'])
                else:
                    new_ch = Channel(**db_fields, is_active=True)
                    db.add(new_ch)
                    created += 1
                    logger.info("Created: %s", ch_data['name'])
        except Exception as exc:
            logger.warning("Failed to seed %s: %s", ch_data['name'], exc)
            continue

    db.commit()
    return {"created": created, "updated": updated}
