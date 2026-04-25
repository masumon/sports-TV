from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger("app.db")


def _add_column_if_missing(engine: Engine, table: str, column: str, definition: str) -> None:
    """Generic helper: add a column to a table if it doesn't exist."""
    try:
        insp = inspect(engine)
        if table not in insp.get_table_names():
            return
        cols = {c["name"] for c in insp.get_columns(table)}
        if column in cols:
            return
        logger.warning("%s.%s missing — running ALTER TABLE", table, column)
        with engine.begin() as conn:
            if engine.dialect.name == "sqlite":
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
            else:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {definition}"))
        logger.info("Schema migration applied: %s.%s added", table, column)
    except Exception as exc:
        # Re-inspect to see if a concurrent process added it
        try:
            if column in {c["name"] for c in inspect(engine).get_columns(table)}:
                return
        except Exception:
            pass
        logger.critical("Could not add %s.%s: %s", table, column, exc, exc_info=True)


def ensure_user_subscription_tier(engine: Engine) -> None:
    """Add subscription_tier to users if missing."""
    try:
        _add_column_if_missing(
            engine, "users", "subscription_tier",
            "VARCHAR(20) NOT NULL DEFAULT 'free'"
        )
    except Exception as exc:
        raise RuntimeError(f"DB schema migration failed (subscription_tier): {exc}") from exc


def ensure_channel_columns(engine: Engine) -> None:
    """Add module and alternate_urls to channels if missing (no Alembic migration)."""
    _add_column_if_missing(
        engine, "channels", "module",
        "VARCHAR(40) NOT NULL DEFAULT 'sports'"
    )
    _add_column_if_missing(
        engine, "channels", "alternate_urls",
        "TEXT"
    )
