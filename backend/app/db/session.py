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
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

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
        # Neon pooler (PgBouncer) does NOT support SCRAM-SHA-256-PLUS, so
        # channel_binding=require causes authentication failure even with the correct
        # password. Strip it — SSL is still enforced via sslmode=require.
        _strip_params = {"channel_binding"}
        clean_query = {k: v for k, v in u.query.items() if k not in _strip_params}
        return str(u.set(drivername="postgresql+psycopg", query=clean_query))
    return "sqlite+aiosqlite:///" + sync_url.split("///", 1)[-1] if "sqlite" in sync_url else str(u)


ASYNC_URL = _to_async_url(DATABASE_URL)
# Use NullPool for async engine: Neon (serverless PostgreSQL) closes idle connections
# aggressively; a persistent pool causes stale-connection 500s on cold starts.
# NullPool opens a fresh connection per request — safe and correct for serverless.
_async_pool_kw: dict = (
    {"poolclass": NullPool}
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
