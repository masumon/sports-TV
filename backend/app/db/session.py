from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings


class Base(DeclarativeBase):
    pass


DATABASE_URL = settings.resolved_database_url

# psycopg3 auto-negotiates SCRAM-SHA-256-PLUS on SSL connections.
# Neon's PgBouncer pooler does NOT support this auth method — it causes
# "password authentication failed" even with correct credentials.
# channel_binding=disable forces plain SCRAM-SHA-256 which PgBouncer supports.
if DATABASE_URL.startswith("sqlite"):
    connect_args: dict = {"check_same_thread": False}
else:
    connect_args = {"channel_binding": "disable"}

_engine_kwargs: dict = {
    "future": True,
    "pool_pre_ping": True,
    "connect_args": connect_args,
}
if not DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["pool_size"] = settings.db_pool_size
    _engine_kwargs["max_overflow"] = settings.db_max_overflow

engine = create_engine(
    DATABASE_URL,
    **_engine_kwargs,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def _to_async_url(sync_url: str) -> str:
    u = make_url(sync_url)
    backend = u.get_backend_name() or ""
    if backend == "sqlite":
        return str(u.set(drivername="sqlite+aiosqlite"))
    if "postgresql" in backend:
        # Use asyncpg (not psycopg3 async) because:
        # - psycopg3 async uses Python's asyncio SSL stack which auto-negotiates
        #   SCRAM-SHA-256-PLUS regardless of channel_binding URL param.
        # - Neon PgBouncer does not support SCRAM-SHA-256-PLUS → auth fails.
        # - asyncpg has its own SCRAM implementation (plain SCRAM-SHA-256),
        #   no channel binding, works perfectly with Neon pooler.
        # asyncpg does NOT understand libpq params — strip sslmode, channel_binding etc.
        _libpq_params = {
            "sslmode", "sslcert", "sslkey", "sslrootcert", "sslcrl",
            "channel_binding", "application_name", "connect_timeout", "options",
        }
        clean_query = {k: v for k, v in u.query.items() if k not in _libpq_params}
        return str(u.set(drivername="postgresql+asyncpg", query=clean_query))
    return "sqlite+aiosqlite:///" + sync_url.split("///", 1)[-1] if "sqlite" in sync_url else str(u)


ASYNC_URL = _to_async_url(DATABASE_URL)
# NullPool: Neon serverless closes idle connections aggressively.
# ssl=True: asyncpg needs explicit SSL flag (not sslmode URL param).
_async_pool_kw: dict = (
    {
        "poolclass": NullPool,
        "connect_args": {"ssl": True},
    }
    if not str(ASYNC_URL).startswith("sqlite+")
    else {"pool_pre_ping": True}
)

async_engine = create_async_engine(ASYNC_URL, **_async_pool_kw)
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    autocommit=False,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
