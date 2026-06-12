"""
BDIX Local CDN Seeder - Auto-import Bangladesh sports channels.
Provides trusted, persistent stream sources with no geo-blocking.
"""
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
        "stream_url": "http://172.32.1.88:1935/tvprogram/BTV/playlist.m3u8",
        "quality_tag": "auto",
        "module": "world_cup_2026",
        "source": "bdix-local",
        "alternate_urls": [],
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
        "alternate_urls": [
            "http://172.32.1.88:1935/tvprogram/T-SPORTS/playlist.m3u8",
            "http://103.55.144.46:80/hls/t-sports.m3u8",
        ],
    },
    {
        "name": "SOMOY TV",
        "country": "Bangladesh",
        "category": "News/Entertainment",
        "language": "Bengali",
        "logo_url": "https://sunplex.net/iptv/logo/somoy-tv.jpg",
        "stream_url": "http://172.32.1.88:1935/tvprogram/SOMOY-TV/playlist.m3u8",
        "quality_tag": "auto",
        "module": "world_cup_2026",
        "source": "bdix-local",
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
        # Check if exists
        existing = db.execute(
            select(Channel).where(
                (Channel.name == ch_data["name"]) & (Channel.country == ch_data["country"])
            )
        ).scalars().first()

        if existing:
            # Update
            for key, val in ch_data.items():
                setattr(existing, key, val)
            existing.is_active = True
            updated += 1
            logger.info(f"Updated: {ch_data['name']}")
        else:
            # Create
            new_ch = Channel(**ch_data, is_active=True)
            db.add(new_ch)
            created += 1
            logger.info(f"Created: {ch_data['name']}")

    db.commit()
    return {"created": created, "updated": updated}
