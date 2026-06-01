import os
from functools import lru_cache

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Global Sports Live TV API"
    app_env: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # Production should point to PostgreSQL, local can use SQLite fallback.
    database_url: str | None = None
    sqlite_fallback_url: str = "sqlite:///./sports_tv.db"

    jwt_secret_key: str = Field(default="replace-with-strong-secret")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    # Admin password reset token (no email — token returned in API response; short TTL for security)
    password_reset_token_ttl_minutes: int = 60
    # Minimum seconds between password reset requests for the same email (abuse / DB load)
    password_reset_rate_limit_seconds: int = 120

    # Canonical defaults (overridable via ADMIN_* env on deploy): user locks these for local/parity.
    admin_email: str = "admin@test.com"
    admin_password: str = "Admin12345!"
    admin_full_name: str = "Platform Admin"
    # When true, each process startup deletes all users except ADMIN_EMAIL (seeding above). Set false only if you need public registration to persist.
    prune_non_default_users_on_startup: bool = True

    cors_origins: str = "http://localhost:3000"
    scraper_source_url: str = "https://iptv-org.github.io/iptv/categories/sports.m3u"
    # When true, sync also fetches the iptv-org master index (~10k+ streams). Heavy; good for filling Neon.
    iptv_full_index_sync: bool = True
    iptv_full_index_url: str = "https://iptv-org.github.io/iptv/index.m3u"
    iptv_full_index_fetch_timeout_seconds: int = 120
    auto_sync_channels_on_startup: bool = True
    # Optional Redis for response caching (GET /sports-tv/channels, filters). If unset, caching is disabled.
    redis_url: str | None = None
    cache_ttl_seconds: int = 300
    # POST /admin/channels/sync — minimum seconds between successful syncs per process (in-memory).
    sync_rate_limit_seconds: int = 60
    # Legacy DB M3U sync interval (admin / GET /sports-tv/channels). Viewer catalog is client-side M3U.
    # Default 0 = scheduler disabled. Set e.g. 30 only if you still rely on DB channel rows.
    scheduled_sync_interval_minutes: int = 15
    # Real fixture schedule sync (OpenLigaDB + optional football-data.org). 0 = disabled.
    live_fixtures_sync_interval_minutes: int = 15
    live_fixtures_days_ahead: int = 14
    openligadb_league_keys: str = "bl1,bl2,dfb"
    football_data_org_api_token: str | None = None
    football_data_competitions: str = "PL,BL1,PD,SA,FL1,WC"
    # CricAPI free tier (100 calls/day) — https://cricapi.com
    cricapi_key: str | None = None
    # Auto-discover new M3U sources every N hours (0 = disabled).
    # Default 0: free-tier Render workers should not run discovery + sync load unless explicitly enabled.
    source_discovery_interval_hours: int = 1
    # Deactivate iptv-org channels not refreshed for this many days.
    channel_stale_days: int = 3
    # Engine pool (PostgreSQL). Neon free tier allows 25 total connections.
    # Render free tier = 1 worker; pool_size=3 + overflow=5 = max 8 connections — safe.
    # On paid/multi-worker deploys set DB_POOL_SIZE=5, DB_MAX_OVERFLOW=10 via env.
    db_pool_size: int = 3
    db_max_overflow: int = 5
    # Dynamic .m3u8 token refresh — how often to check (Playwright). 0 = disabled.
    # Default 0: Playwright on a small Render free instance is a common OOM / CPU source.
    m3u8_refresh_interval_minutes: int = 0
    # Sample active channels and deactivate dead URLs. 0 = do not run scheduled checks.
    # When >0, runs on this interval. Was previously hardcoded to 15m whenever M3U sync was on
    # (harsh for free tier + datacenter-IP false negatives). Set e.g. 60–120 on paid/stable hosts.
    stream_validation_interval_minutes: int = 10
    # 0 means validate all active channels in each scheduled pass.
    stream_validation_sample_limit: int = 0

    # Raw M3U text for GET /proxy/playlist — Redis + in-process fallback (free-tier friendly).
    # Env: PROXY_PLAYLIST_CACHE_TTL_SECONDS (default 5400 = 90 min, within 60–120m guidance).
    proxy_playlist_cache_ttl_seconds: int = 5400

    # Upstream geo: spoof client-egress hints (datacenter bypass is best-effort; use proxy below if needed).
    stream_geo_bypass_enabled: bool = True
    # Optional HTTP(S) proxy for all upstream httpx calls in proxy.py (Webshare, Proxyium, etc.).
    stream_upstream_http_proxy: str | None = Field(
        default=None,
        description="e.g. http://user:pass@host:port — applied to playlist + stream fetches",
    )

    # Allowlisted preset for /proxy/stream?header_profile=tsports — merged server-side only (see proxy.py).
    # Env: STREAM_PROFILE_TSPORTS_COOKIE, STREAM_PROFILE_TSPORTS_USER_AGENT
    stream_profile_tsports_cookie: str | None = Field(
        default=None,
        description="e.g. Edge-Cache-Cookie=URLPrefix=... (rotate when upstream returns 403)",
    )
    stream_profile_tsports_user_agent: str | None = Field(
        default=None,
        description="Sent as User-Agent for tsports profile; default (Linux;Android 14) if unset",
    )

    # BDIX IPTV Aggregation — extra community M3U sources appended to Bangladesh sync.
    # Comma-separated. Leave empty to use BDIX_SOURCES defaults in bdix_aggregator.py.
    bdix_extra_sources: str = Field(
        default="",
        description="Comma-separated extra BDIX M3U URLs",
    )

    # Stream validation worker count (async path). Free-tier safe default: 30.
    stream_validation_async_workers: int = Field(
        default=30,
        description="Concurrent aiohttp workers for async stream validation",
    )

    # Internal sync secret for /internal/sync and /aggregator/bdix/sync
    internal_sync_secret: str | None = Field(
        default=None,
        description="Shared secret for protected internal sync endpoints",
    )

    # EPG XML URL embedded in generated M3U playlists
    epg_url: str = Field(
        default="https://avkb.short.gy/epg.xml.gz",
        description="XMLTV EPG URL written into generated playlist headers",
    )

    model_config = SettingsConfigDict(
        env_file=(
            None
            if os.getenv("APP_ENV", "").strip().strip("\"'").lower() == "production"
            else ".env"
        ),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        env_ignore_empty=True,
    )

    @field_validator("*", mode="before")
    @classmethod
    def normalize_string_values(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        if (
            len(normalized) >= 2
            and normalized[0] == normalized[-1]
            and normalized[0] in {'"', "'"}
        ):
            normalized = normalized[1:-1].strip()
        return normalized

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        cleaned = value.strip()
        if (
            len(cleaned) >= 2
            and cleaned[0] == cleaned[-1]
            and cleaned[0] in {'"', "'"}
        ):
            cleaned = cleaned[1:-1].strip()
        if not cleaned:
            return None

        # Render and other providers often expose postgres URLs without driver hints.
        # Force psycopg3-compatible SQLAlchemy URL to avoid startup failures.
        if cleaned.startswith("postgres://"):
            cleaned = "postgresql+psycopg://" + cleaned[len("postgres://") :]
        elif cleaned.startswith("postgresql://") and not cleaned.startswith("postgresql+"):
            cleaned = "postgresql+psycopg://" + cleaned[len("postgresql://") :]

        # Neon PgBouncer pooler does not support SCRAM-SHA-256-PLUS (channel binding).
        # Replace channel_binding=require with channel_binding=disable so both sync
        # and async psycopg3 engines use plain SCRAM-SHA-256 authentication.
        import re as _re
        cleaned = _re.sub(r"channel_binding=[^&]*", "channel_binding=disable", cleaned)
        # If channel_binding was not in URL at all, add it
        if "channel_binding" not in cleaned and "?" in cleaned:
            cleaned += "&channel_binding=disable"
        elif "channel_binding" not in cleaned:
            cleaned += "?channel_binding=disable"

        return cleaned

    @field_validator("cors_origins", mode="before")
    @classmethod
    def normalize_cors_origins(cls, value: object) -> object:
        """Strip whitespace and trailing slashes so CORS matches browser origins exactly."""
        if not isinstance(value, str):
            return value
        parts = []
        for origin in value.split(","):
            o = origin.strip().rstrip("/")
            if o:
                parts.append(o)
        return ",".join(parts) if parts else value

    @property
    def resolved_database_url(self) -> str:
        return self.database_url or self.sqlite_fallback_url

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def _reject_default_jwt_in_prod(self) -> "Settings":
        v = (self.jwt_secret_key or "").strip()
        if (self.app_env or "").lower() in {"production", "prod"} and v in {"", "replace-with-strong-secret", "change-me", "secret"}:
            msg = "Set JWT_SECRET_KEY to a long random value in production (e.g. openssl rand -hex 32)."
            raise ValueError(msg)
        return self

    @model_validator(mode="after")
    def _require_postgres_in_prod(self) -> "Settings":
        if (self.app_env or "").lower() not in {"production", "prod"}:
            return self
        raw = (self.database_url or "").strip().lower()
        if not raw or "sqlite" in raw:
            raise ValueError(
                "Set DATABASE_URL to PostgreSQL (e.g. Neon) in production — SQLite is not supported for APP_ENV=production."
            )
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
