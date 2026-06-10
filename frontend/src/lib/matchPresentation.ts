import type { LiveFixture } from "@/lib/types";
import type { TeamForm } from "@/components/matches/HeadToHead";
import type { LineupPlayer, TeamLineup } from "@/components/matches/LineupList";

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

export function deriveFormFromFixture(fixture: LiveFixture, side: "home" | "away"): TeamForm[] {
  const seed = `${fixture.id}-${side}`;
  const pool: TeamForm[] = ["W", "L", "D"];
  return Array.from({ length: 5 }, (_, i) => pool[(seed.charCodeAt(i % seed.length) + i) % pool.length]!);
}

export function buildLineup(teamName: string, _fixtureId: number, side: "home" | "away"): TeamLineup {
  const names =
    side === "home"
      ? ["Player A", "Player B", "Player C", "Player D", "Player E", "Player F", "Player G", "Player H", "Player I", "Player J", "Player K"]
      : ["Player L", "Player M", "Player N", "Player O", "Player P", "Player Q", "Player R", "Player S", "Player T", "Player U", "Player V"];

  const startingXI: LineupPlayer[] = names.map((name, index) => ({
    number: index + 1,
    name: `${teamName.split(" ")[0] ?? "Team"} ${name}`,
    role: index === 0 ? "keeper" : index < 6 ? "bat" : "bowl",
    isCaptain: index === 1,
    isKeeper: index === 0,
  }));

  return {
    team: teamName,
    startingXI,
    substitutes: [
      { number: 12, name: `${teamName} Sub 1`, role: "allrounder" },
      { number: 13, name: `${teamName} Sub 2`, role: "bowl" },
    ],
  };
}

export function presentationFromFixture(fixture: LiveFixture) {
  return {
    stadium: fixture.league_name,
    format: fixture.sport,
    homeForm: deriveFormFromFixture(fixture, "home"),
    awayForm: deriveFormFromFixture(fixture, "away"),
    homeLineup: buildLineup(fixture.home_team, fixture.id, "home"),
    awayLineup: buildLineup(fixture.away_team, fixture.id, "away"),
    homeWins: (fixture.id % 5) + 2,
    awayWins: (fixture.id % 4) + 1,
    draws: fixture.id % 3,
  };
}
