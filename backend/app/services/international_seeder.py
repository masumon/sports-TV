"""
International Free Broadcasting Sources Seeder
Legal, authorized, geo-free sources for World Cup 2026 commentary in multiple languages
"""
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
        "source": "international-free",
        "alternate_urls": ["https://www.youtube.com/c/cazeTV/live"],
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
    },
    # GERMANY - ZDF (FREE, public broadcaster)
    {
        "name": "ZDF - Fußball (German Commentary)",
        "country": "Germany",
        "category": "Sports",
        "language": "German",
        "logo_url": "https://www.zdf.de/assets/zdf-icon-1eb2e78b.png",
        "stream_url": "https://www.zdf.de/live",
        "quality_tag": "720p",
        "module": "world_cup_2026",
        "source": "international-free",
        "alternate_urls": ["https://www.zdf.de/sport/live"],
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
    },
    # SPAIN - RTVE (FREE, public broadcaster)
    {
        "name": "RTVE - Mundial 2026 (Spanish Commentary)",
        "country": "Spain",
        "category": "Sports",
        "language": "Spanish",
        "logo_url": "https://www.rtve.es/favicon.ico",
        "stream_url": "https://www.rtve.es/directo/la-1/",
        "quality_tag": "720p",
        "module": "world_cup_2026",
        "source": "international-free",
        "alternate_urls": ["https://www.rtve.es/play/videos/"],
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
        # Check if exists
        existing = db.execute(
            select(Channel).where(
                (Channel.name == ch_data["name"]) & (Channel.country == ch_data["country"])
            )
        ).scalars().first()

        if existing:
            # Update with new URLs
            for key, val in ch_data.items():
                setattr(existing, key, val)
            existing.is_active = True
            updated += 1
            logger.info(f"Updated: {ch_data['name']}")
        else:
            # Create new
            new_ch = Channel(**ch_data, is_active=True)
            db.add(new_ch)
            created += 1
            logger.info(f"Created: {ch_data['name']}")

    db.commit()
    logger.info(f"International seed: {created} created, {updated} updated")
    return {"created": created, "updated": updated}
