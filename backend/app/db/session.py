from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

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
        # asyncpg does NOT understand libpq/psycopg URL params (sslmode, connect_timeout, etc.).
        # Strip them here; SSL is handled via connect_args={"ssl": True} on the engine instead.
        _libpq_params = {
            "sslmode", "sslcert", "sslkey", "sslrootcert", "sslcrl",
            "application_name", "connect_timeout", "options",
        }
        clean_query = {k: v for k, v in u.query.items() if k not in _libpq_params}
        return str(u.set(drivername="postgresql+asyncpg", query=clean_query))
    return "sqlite+aiosqlite:///" + sync_url.split("///", 1)[-1] if "sqlite" in sync_url else str(u)


ASYNC_URL = _to_async_url(DATABASE_URL)
_async_pool_kw: dict = (
    {
        "pool_pre_ping": True,
        "pool_size": settings.db_pool_size,
        "max_overflow": settings.db_max_overflow,
        # asyncpg uses ssl=True (not sslmode string). Neon requires SSL.
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
