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

    admin_email: str = "admin@gstv.local"
    admin_password: str = "Admin12345!"
    admin_full_name: str = "Platform Admin"

    cors_origins: str = "http://localhost:3000"
    scraper_source_url: str = "https://iptv-org.github.io/iptv/categories/sports.m3u"
    auto_sync_channels_on_startup: bool = False
    # Optional Redis for response caching (GET /channels, GET /live-scores). If unset, caching is disabled.
    redis_url: str | None = None
    cache_ttl_seconds: int = 300
    # POST /admin/channels/sync — minimum seconds between successful syncs per process (in-memory).
    sync_rate_limit_seconds: int = 60
    # Background M3U sync interval (0 = disabled). Use one worker or expect duplicate work.
    scheduled_sync_interval_minutes: int = 0
    # Engine pool (PostgreSQL). Keep low on free-tier DBs (e.g. Neon allows 25 connections).
    db_pool_size: int = 5
    db_max_overflow: int = 10

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

        return cleaned

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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
