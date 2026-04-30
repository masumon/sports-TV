#!/usr/bin/env python3
"""
One-shot channel sync into PostgreSQL (e.g. Neon). Uses the same pipeline as POST /admin/channels/sync.

Prerequisites:
  - Set DATABASE_URL to your Neon connection string (copy from Neon dashboard:
    use the SQLAlchemy / “connection string” form; this app expects postgres+psycopg).
  - From repo root, run this file with cwd = backend/ (see below).

Usage:
  cd backend
  set DATABASE_URL=postgresql+psycopg://...
  set IPTV_FULL_INDEX_SYNC=true
  python scripts/sync_neon_channels.py

  # Or without env flag:
  python scripts/sync_neon_channels.py --full-index
"""
from __future__ import annotations

import argparse
import logging
import os
import sys

_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load_backend_env_file() -> None:
    """Populate os.environ from backend/.env (KEY=VALUE). Works even when APP_ENV=production."""
    repo_root = os.path.dirname(_BACKEND_ROOT)
    candidates: list[str] = []
    for base in (_BACKEND_ROOT, repo_root):
        for name in (".env", ".env.local"):
            candidates.append(os.path.join(base, name))
    seen: set[str] = set()
    for path in candidates:
        if path in seen:
            continue
        seen.add(path)
        if not os.path.isfile(path):
            continue
        try:
            with open(path, encoding="utf-8") as f:
                for raw in f:
                    line = raw.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" not in line:
                        continue
                    key, _, val = line.partition("=")
                    key = key.strip()
                    if not key:
                        continue
                    val = val.strip()
                    if len(val) >= 2 and val[0] == val[-1] and val[0] in {'"', "'"}:
                        val = val[1:-1].strip()
                    if key not in os.environ or not (os.environ.get(key) or "").strip():
                        os.environ[key] = val
        except OSError:
            continue


def _ensure_database_url() -> None:
    for key in ("DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL"):
        v = (os.environ.get(key) or "").strip()
        if v and not (os.environ.get("DATABASE_URL") or "").strip():
            os.environ["DATABASE_URL"] = v


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync iptv-org M3U sources into DATABASE_URL (Neon).")
    parser.add_argument(
        "--full-index",
        action="store_true",
        help="Include iptv-org master index.m3u (~10k+ streams); sets IPTV_FULL_INDEX_SYNC for this run.",
    )
    parser.add_argument(
        "--no-discovery",
        action="store_true",
        help="Skip m3u_discovery extra URLs (faster, fewer upstream fetches).",
    )
    parser.add_argument(
        "--fixtures",
        action="store_true",
        help="After M3U sync, also pull real match fixtures into the database (OpenLigaDB + optional football-data.org).",
    )
    parser.add_argument(
        "--fixtures-only",
        action="store_true",
        help="Only sync live match schedule — skip M3U channel sync.",
    )
    args = parser.parse_args()

    if args.full_index:
        os.environ["IPTV_FULL_INDEX_SYNC"] = "true"

    os.chdir(_BACKEND_ROOT)
    _load_backend_env_file()
    _ensure_database_url()
    if _BACKEND_ROOT not in sys.path:
        sys.path.insert(0, _BACKEND_ROOT)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        stream=sys.stdout,
    )

    from app.core.config import settings
    from app.services.automation import run_channel_sync, run_live_fixtures_job

    if not (settings.database_url or "").strip():
        print(
            "DATABASE_URL is missing or empty. In backend/.env add your Neon connection string on one line, e.g.\n"
            "  DATABASE_URL=postgresql+psycopg://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require\n"
            "(Copy the full URI from Neon dashboard → Connection details.)",
            file=sys.stderr,
        )
        return 1

    if args.fixtures_only:
        fx = run_live_fixtures_job(source="sync_neon_channels_cli")
        print("Fixtures sync finished:", fx)
        return 0

    result = run_channel_sync(
        include_discovery=not args.no_discovery,
        source="sync_neon_channels_cli",
    )
    print("Sync finished:", result)
    if args.fixtures:
        fx = run_live_fixtures_job(source="sync_neon_channels_cli")
        print("Fixtures sync finished:", fx)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
