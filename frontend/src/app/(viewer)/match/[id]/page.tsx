"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ViewerPageShell } from "@/components/layout/ViewerPageShell";
import { Button } from "@/components/ui/Button";
import { HeadToHead } from "@/components/matches/HeadToHead";
import { LineupList } from "@/components/matches/LineupList";
import { apiClient } from "@/lib/apiClient";
import { isFixtureLive, presentationFromFixture } from "@/lib/matchPresentation";
import type { LiveFixture } from "@/lib/types";

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const [fixture, setFixture] = useState<LiveFixture | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getLiveFixtures({ hours_back: 24, days_ahead: 14 });
      const id = Number(params.id);
      setFixture(res.items.find((item) => item.id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const presentation = useMemo(
    () => (fixture ? presentationFromFixture(fixture) : null),
    [fixture],
  );

  if (loading) {
    return (
      <ViewerPageShell>
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-10 w-48 animate-pulse rounded-lg bg-surface-elevated" />
          <div className="h-64 animate-pulse rounded-2xl bg-surface-elevated" />
        </div>
      </ViewerPageShell>
    );
  }

  if (!fixture || !presentation) {
    return (
      <ViewerPageShell>
        <div className="mx-auto max-w-3xl py-16 text-center">
          <p className="text-lg font-semibold text-foreground">Match not found</p>
          <Link href="/sports" className="mt-4 inline-block text-sm text-accent-cyan hover:text-accent-gold">
            ← Back to Sports Calendar
          </Link>
        </div>
      </ViewerPageShell>
    );
  }

  const kickoff = fixture.starts_at_utc
    ? new Date(fixture.starts_at_utc).toLocaleString()
    : "TBD";

  return (
    <ViewerPageShell>
      <div className="mx-auto w-full max-w-5xl space-y-8 pb-24">
        <Link href="/sports" className="inline-flex text-sm font-semibold text-accent-cyan transition hover:text-accent-gold">
          ← Sports Calendar
        </Link>

        <header className="rounded-2xl border border-border-subtle bg-surface-secondary p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-cyan">
            {isFixtureLive(fixture) ? "Live" : "Upcoming"} · {fixture.sport}
          </p>
          <h1 className="mt-2 text-heading-1 text-foreground">
            {fixture.home_team} vs {fixture.away_team}
          </h1>
          <p className="mt-2 text-sm text-foreground-secondary">{kickoff}</p>
          <p className="text-sm text-foreground-muted">{fixture.league_name}</p>
          <p className="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(245,166,35,0.12)", color: "var(--primary-accent)" }}>
            Status: {fixture.status || "Scheduled"}
          </p>
        </header>

        {fixture.suggested_channels.length > 0 && (
          <div className="rounded-2xl border border-border-subtle bg-surface-secondary p-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Watch on TV</p>
            <div className="flex flex-wrap gap-2">
              {fixture.suggested_channels.map((ch) => (
                <Link
                  key={ch.id}
                  href={`/?channel_id=${ch.id}`}
                  className="rounded-xl px-3 py-2 text-xs font-semibold transition hover:opacity-90"
                  style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", color: "var(--primary-accent)" }}
                >
                  {ch.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <HeadToHead
          homeTeam={fixture.home_team}
          awayTeam={fixture.away_team}
          homeForm={presentation.homeForm}
          awayForm={presentation.awayForm}
          stadium={presentation.stadium}
          capacity="50,000+"
          homeWins={presentation.homeWins}
          awayWins={presentation.awayWins}
          draws={presentation.draws}
        />

        <LineupList home={presentation.homeLineup} away={presentation.awayLineup} />

        <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 border-t border-glass-border bg-surface-secondary/95 p-3 backdrop-blur-md md:static md:border-0 md:bg-transparent md:p-0">
          <Button
            variant="reminder"
            className="w-full md:w-auto"
            onClick={() => toast.success(`Reminder set for ${fixture.home_team} vs ${fixture.away_team}`)}
          >
            Set Reminder
          </Button>
        </div>
      </div>
    </ViewerPageShell>
  );
}
