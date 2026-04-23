from functools import lru_cache

from pydantic import Field
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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def resolved_database_url(self) -> str:
        return self.database_url or self.sqlite_fallback_url

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
