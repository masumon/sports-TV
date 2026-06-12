"""Playlist import service - handle M3U8 ingestion."""

from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert

from app.models.channel import Channel
from app.models.playlist import Playlist
from app.utils.m3u8_parser import parse_m3u8, validate_m3u8, M3U8Channel


async def import_m3u8_from_content(
    db: AsyncSession,
    name: str,
    content: str,
    source_type: str = "m3u8_file",
    source_url: Optional[str] = None,
    module_default: str = "global_sports",
) -> dict:
    """
    Import channels from M3U8 content.

    Args:
        db: Database session
        name: Playlist name
        content: M3U8 file content
        source_type: Type of source (m3u8_file, m3u8_url, etc)
        source_url: Optional URL if fetching from remote
        module_default: Default module for channels

    Returns:
        {"success": bool, "playlist_id": int, "created": int, "updated": int, "error": str}
    """

    # Validate M3U8
    if not validate_m3u8(content):
        return {
            "success": False,
            "error": "Invalid M3U8 format - must start with #EXTM3U",
        }

    try:
        # Parse channels
        parsed = parse_m3u8(content, base_url=source_url)
        if not parsed:
            return {
                "success": False,
                "error": "No channels found in M3U8",
            }

        # Create/update playlist record
        playlist_query = select(Playlist).where(Playlist.name == name)
        existing_playlist = (await db.execute(playlist_query)).scalars().first()

        if existing_playlist:
            playlist = existing_playlist
            playlist.last_sync_at = datetime.utcnow()
            playlist.last_sync_status = "success"
            playlist.source_url = source_url
        else:
            playlist = Playlist(
                name=name,
                source_type=source_type,
                source_url=source_url,
                module_default=module_default,
                last_sync_at=datetime.utcnow(),
                last_sync_status="success",
                is_active=True,
            )
            db.add(playlist)
            await db.flush()  # Get playlist.id

        # Import channels
        created = 0
        updated = 0

        for parsed_ch in parsed:
            # Check if channel exists (by name + country combo)
            ch_query = select(Channel).where(
                (Channel.name == parsed_ch.name) &
                (Channel.country == parsed_ch.country)
            )
            existing_ch = (await db.execute(ch_query)).scalars().first()

            if existing_ch:
                # Update existing
                existing_ch.stream_url = parsed_ch.url
                existing_ch.logo_url = parsed_ch.logo_url
                existing_ch.language = parsed_ch.language
                existing_ch.quality_tag = parsed_ch.quality_tag
                existing_ch.category = parsed_ch.group_title or "Sports"
                existing_ch.module = module_default
                existing_ch.source = f"playlist_{playlist.id}"
                existing_ch.is_active = True
                updated += 1
            else:
                # Create new
                new_ch = Channel(
                    name=parsed_ch.name,
                    stream_url=parsed_ch.url,
                    logo_url=parsed_ch.logo_url,
                    country=parsed_ch.country,
                    language=parsed_ch.language,
                    category=parsed_ch.group_title or "Sports",
                    quality_tag=parsed_ch.quality_tag,
                    module=module_default,
                    source=f"playlist_{playlist.id}",
                    is_active=True,
                )
                db.add(new_ch)
                created += 1

        # Update playlist channel count
        playlist.channel_count = created + updated

        # Commit
        await db.commit()

        return {
            "success": True,
            "playlist_id": playlist.id,
            "playlist_name": playlist.name,
            "created": created,
            "updated": updated,
            "total": created + updated,
        }

    except Exception as e:
        await db.rollback()
        return {
            "success": False,
            "error": f"Import failed: {str(e)}",
        }


async def get_playlists(db: AsyncSession) -> list[dict]:
    """Get all playlists."""
    result = await db.execute(select(Playlist).order_by(Playlist.updated_at.desc()))
    playlists = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "source_type": p.source_type,
            "is_active": p.is_active,
            "channel_count": p.channel_count,
            "last_sync_at": p.last_sync_at.isoformat() if p.last_sync_at else None,
            "last_sync_status": p.last_sync_status,
        }
        for p in playlists
    ]
