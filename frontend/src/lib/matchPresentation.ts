import type { LiveFixture } from "@/lib/types";

export function fixtureDateKey(fixture: LiveFixture): string {
  if (!fixture.starts_at_utc) return "";
  return fixture.starts_at_utc.slice(0, 10);
}

export function isFixtureLive(fixture: LiveFixture): boolean {
  const startMs = fixture.starts_at_utc ? new Date(fixture.starts_at_utc).getTime() : 0;
  const nowMs = Date.now();
  const elapsedMin = startMs > 0 ? Math.floor((nowMs - startMs) / 60_000) : 0;
  const status = (fixture.status || "").toLowerCase();
  return startMs > 0 && startMs <= nowMs && status !== "finished" && elapsedMin <= 130;
}
