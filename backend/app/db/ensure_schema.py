from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger("app.db")


def ensure_user_subscription_tier(engine: Engine) -> None:
    """Add subscription_tier to users if missing (no Alembic in this project)."""
    try:
        insp = inspect(engine)
        if "users" not in insp.get_table_names():
            return
        cols = {c["name"] for c in insp.get_columns("users")}
        if "subscription_tier" in cols:
            return
        with engine.begin() as conn:
            if engine.dialect.name == "sqlite":
                conn.execute(
                    text("ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free'")
                )
            else:
                conn.execute(text("ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free'"))
        logger.info("Applied schema: users.subscription_tier")
    except Exception:
        logger.exception("ensure_user_subscription_tier failed")
