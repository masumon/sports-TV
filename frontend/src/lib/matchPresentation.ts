import type { LiveFixture } from "@/lib/types";

export const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
export const FIXTURE_HOURS_BACK = 120;

export function fixtureDateKey(fixture: LiveFixture): string {
  if (!fixture.starts_at_utc) return "";
  return fixture.starts_at_utc.slice(0, 10);
}

export function fixtureStartMs(fixture: LiveFixture): number {
  return fixture.starts_at_utc ? new Date(fixture.starts_at_utc).getTime() : 0;
}

export function isFixtureLive(fixture: LiveFixture): boolean {
  const startMs = fixtureStartMs(fixture);
  const nowMs = Date.now();
  const elapsedMin = startMs > 0 ? Math.floor((nowMs - startMs) / 60_000) : 0;
  const status = (fixture.status || "").toLowerCase();
  return startMs > 0 && startMs <= nowMs && status !== "finished" && elapsedMin <= 130;
}

export function isFixtureFinished(fixture: LiveFixture): boolean {
  const startMs = fixtureStartMs(fixture);
  const elapsedMin = startMs > 0 ? Math.floor((Date.now() - startMs) / 60_000) : 0;
  const status = (fixture.status || "").toLowerCase();
  return status === "finished" || elapsedMin > 130;
}

export function isWithinLast5Days(fixture: LiveFixture): boolean {
  const startMs = fixtureStartMs(fixture);
  if (!startMs) return false;
  return Date.now() - startMs <= FIVE_DAYS_MS;
}

export type FixtureGroups = {
  live: LiveFixture[];
  upcoming: LiveFixture[];
  recentResults: LiveFixture[];
};

export function groupFixtures(fixtures: LiveFixture[]): FixtureGroups {
  const live: LiveFixture[] = [];
  const upcoming: LiveFixture[] = [];
  const recentResults: LiveFixture[] = [];

  for (const fx of fixtures) {
    const startMs = fixtureStartMs(fx);
    if (isFixtureFinished(fx)) {
      if (isWithinLast5Days(fx)) recentResults.push(fx);
    } else if (startMs > 0 && startMs <= Date.now()) {
      live.push(fx);
    } else {
      upcoming.push(fx);
    }
  }

  live.sort((a, b) => fixtureStartMs(b) - fixtureStartMs(a));
  upcoming.sort((a, b) => fixtureStartMs(a) - fixtureStartMs(b));
  recentResults.sort((a, b) => fixtureStartMs(b) - fixtureStartMs(a));
  return { live, upcoming, recentResults };
}

export type DateMatchSummary = {
  total: number;
  live: number;
  upcoming: number;
  finished: number;
};

export function summarizeFixturesByDate(fixtures: LiveFixture[]): Map<string, DateMatchSummary> {
  const map = new Map<string, DateMatchSummary>();
  for (const fx of fixtures) {
    const key = fixtureDateKey(fx);
    if (!key) continue;
    const entry = map.get(key) ?? { total: 0, live: 0, upcoming: 0, finished: 0 };
    entry.total += 1;
    if (isFixtureLive(fx)) entry.live += 1;
    else if (isFixtureFinished(fx)) entry.finished += 1;
    else entry.upcoming += 1;
    map.set(key, entry);
  }
  return map;
}
