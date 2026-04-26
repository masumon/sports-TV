#!/usr/bin/env python3
"""
Smoke-check M3U seed URLs (exit 0 if all OK, 1 if any fail).
Run in CI or locally: python scripts/check_m3u_sources.py
"""
from __future__ import annotations

import sys
import urllib.error
import urllib.request

# Keep in sync with backend seeds (iptv_scraper + discovery light list)
SEEDS: list[str] = [
    "https://iptv-org.github.io/iptv/categories/sports.m3u",
    "https://iptv-org.github.io/iptv/countries/in.m3u",
    "https://iptv-org.github.io/iptv/countries/bd.m3u",
    "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
]


def check(url: str, timeout: float = 12.0) -> tuple[bool, str]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "GSTV-HealthCheck/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            chunk = r.read(600).decode("utf-8", errors="ignore")
        if "#EXTM3U" in chunk or "#EXTINF" in chunk:
            return True, "ok"
        return False, "not m3u"
    except Exception as e:
        return False, str(e)


def main() -> int:
    bad: list[str] = []
    for u in SEEDS:
        ok, msg = check(u)
        print(f"{'OK ' if ok else 'ERR'} {u} :: {msg}")
        if not ok:
            bad.append(u)
    if bad:
        print(f"\nFailed {len(bad)}/{len(SEEDS)}", file=sys.stderr)
        return 1
    print(f"\nAll {len(SEEDS)} sources reachable.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
