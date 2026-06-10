"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ViewerPageShell } from "@/components/layout/ViewerPageShell";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { apiClient } from "@/lib/apiClient";
import { FIXTURE_HOURS_BACK, fixtureScoreLabel, fixtureStatusLabel, isFixtureFinished, isFixtureLive } from "@/lib/matchPresentation";
import type { LiveFixture } from "@/lib/types";

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const [fixture, setFixture] = useState<LiveFixture | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getLiveFixtures({ hours_back: FIXTURE_HOURS_BACK, days_ahead: 14 });
      const id = Number(params.id);
      setFixture(res.items.find((item) => item.id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <ViewerPageShell>
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-10 w-48 animate-pulse rounded-lg skeleton-shimmer" />
          <div className="h-64 animate-pulse rounded-2xl skeleton-shimmer" />
        </div>
      </ViewerPageShell>
    );
  }

  if (!fixture) {
    return (
      <ViewerPageShell>
        <div className="mx-auto max-w-3xl py-16 text-center">
          <p className="text-lg font-semibold text-foreground">Match not found</p>
          <Link href="/sports" className="mt-4 inline-block text-sm text-accent-cyan hover:text-accent-gold">
            ← Back to Sports Hub
          </Link>
        </div>
      </ViewerPageShell>
    );
  }

  const kickoff = fixture.starts_at_utc
    ? new Date(fixture.starts_at_utc).toLocaleString()
    : "TBD";
  const live = isFixtureLive(fixture);
  const finished = isFixtureFinished(fixture);
  const scoreLabel = fixtureScoreLabel(fixture);
  const isCricket = (fixture.sport || "").toLowerCase().includes("cricket");
  const isFootball = !isCricket;

  return (
    <ViewerPageShell>
      <div className="mx-auto w-full max-w-5xl space-y-6 pb-24">
        <Link href="/sports" className="inline-flex text-sm font-semibold text-accent-cyan transition hover:text-accent-gold">
          ← Sports Hub
        </Link>

        <header className="glass-premium rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-cyan">
            {live ? "Live" : finished ? "Recent Result" : "Upcoming"} · {fixture.sport}
          </p>
          <h1 className="mt-2 text-heading-1 font-bengali text-foreground">
            {fixture.home_team} vs {fixture.away_team}
          </h1>
          <p className="mt-2 text-sm text-foreground-secondary">{kickoff}</p>
          <p className="text-sm text-foreground-muted">{fixture.league_name}</p>
          <p className="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(245,166,35,0.12)", color: "var(--primary-accent)" }}>
            {fixtureStatusLabel(fixture)}
            {scoreLabel ? ` · ${scoreLabel}` : ""}
          </p>
          {fixture.data_attribution ? (
            <p className="mt-3 text-xs text-foreground-muted">{fixture.data_attribution}</p>
          ) : null}
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {isFootball ? (
            <GlassPanel variant="premium" padding="md">
              <h2 className="text-heading-3 text-foreground">Football Summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4 border-b border-glass-border pb-2">
                  <dt className="text-foreground-muted">Final Score</dt>
                  <dd className="font-semibold text-foreground">
                    {scoreLabel || (finished ? "—" : live ? "In progress" : "TBD")}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-glass-border pb-2">
                  <dt className="text-foreground-muted">Goals</dt>
                  <dd className="text-foreground-secondary">Detailed goal data when available from provider</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-glass-border pb-2">
                  <dt className="text-foreground-muted">Possession</dt>
                  <dd className="text-foreground-secondary">—</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-foreground-muted">Cards & Timeline</dt>
                  <dd className="text-foreground-secondary">—</dd>
                </div>
              </dl>
            </GlassPanel>
          ) : null}

          {isCricket ? (
            <GlassPanel variant="premium" padding="md">
              <h2 className="text-heading-3 text-foreground">Cricket Scorecard</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4 border-b border-glass-border pb-2">
                  <dt className="text-foreground-muted">Full Score</dt>
                  <dd className="font-semibold text-foreground">
                    {scoreLabel || (finished ? "—" : live ? "In progress" : "TBD")}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-glass-border pb-2">
                  <dt className="text-foreground-muted">Batting</dt>
                  <dd className="text-foreground-secondary">—</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-glass-border pb-2">
                  <dt className="text-foreground-muted">Bowling</dt>
                  <dd className="text-foreground-secondary">—</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-foreground-muted">Partnerships</dt>
                  <dd className="text-foreground-secondary">—</dd>
                </div>
              </dl>
            </GlassPanel>
          ) : null}

          <GlassPanel variant="premium" padding="md" className="md:col-span-2">
            <h2 className="text-heading-3 text-foreground">Match Info</h2>
            <p className="mt-2 text-sm text-foreground-secondary">
              {finished
                ? "Completed match from the last 5 days. Full stats depend on the connected sports data provider."
                : live
                  ? "Match is live. Watch on linked channels below."
                  : "Upcoming fixture. Set a reminder or browse channels."}
            </p>
          </GlassPanel>
        </div>

        {fixture.suggested_channels.length > 0 ? (
          <GlassPanel variant="premium" padding="md">
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
          </GlassPanel>
        ) : (
          <GlassPanel variant="premium" padding="md" className="text-center">
            <p className="text-sm text-foreground-muted">No linked TV channels for this match yet.</p>
            <Link href="/" className="mt-2 inline-block text-xs font-semibold text-accent-cyan hover:text-accent-gold">
              Browse live channels →
            </Link>
          </GlassPanel>
        )}

        <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 border-t border-glass-border glass-premium p-3 md:static md:border-0 md:bg-transparent md:p-0">
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
