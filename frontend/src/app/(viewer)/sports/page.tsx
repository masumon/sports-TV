"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ViewerPageShell } from "@/components/layout/ViewerPageShell";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { MatchCalendar } from "@/components/matches/MatchCalendar";
import { MatchCard } from "@/components/matches/MatchCard";
import { apiClient } from "@/lib/apiClient";
import { useI18n } from "@/lib/i18n/LocaleContext";
import { fixtureDateKey, isFixtureLive } from "@/lib/matchPresentation";
import type { LiveFixture } from "@/lib/types";

export default function SportsPage() {
  const { locale } = useI18n();
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [fixtures, setFixtures] = useState<LiveFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFixtures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getLiveFixtures({ hours_back: 6, days_ahead: 14 });
      setFixtures(res.items);
    } catch {
      setError("Could not load match schedule");
      toast.error("Could not load fixtures");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFixtures();
  }, [loadFixtures]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) void loadFixtures();
    }, 120_000);
    return () => clearInterval(id);
  }, [loadFixtures]);

  const datesWithMatches = useMemo(
    () => [...new Set(fixtures.map(fixtureDateKey).filter(Boolean))],
    [fixtures],
  );

  const selectedKey = selectedDate.toISOString().slice(0, 10);
  const dayFixtures = useMemo(
    () => fixtures.filter((fx) => fixtureDateKey(fx) === selectedKey),
    [fixtures, selectedKey],
  );

  const shiftWeek = (direction: -1 | 1) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + direction * 7);
      return next;
    });
  };

  const handleReminder = (match: LiveFixture) => {
    toast.success(`Reminder set: ${match.home_team} vs ${match.away_team}`);
  };

  return (
    <ViewerPageShell>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-heading-1 font-bengali text-foreground">Sports Calendar</h1>
            <p className="mt-1 text-sm text-foreground-secondary">Match schedule and reminders</p>
          </div>
          <button
            type="button"
            onClick={() => void loadFixtures()}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground-muted"
            style={{ border: "1px solid var(--border)" }}
            aria-label="Refresh schedule"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        <MatchCalendar
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          datesWithMatches={datesWithMatches}
          locale={locale}
          onPrevWeek={() => shiftWeek(-1)}
          onNextWeek={() => shiftWeek(1)}
        />

        <section className="space-y-3">
          <h2 className="text-heading-2 text-foreground">Matches</h2>
          {loading && fixtures.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-elevated" />
              ))}
            </div>
          ) : error ? (
            <GlassPanel className="py-10 text-center">
              <p className="text-sm font-semibold text-foreground">{error}</p>
              <button
                type="button"
                onClick={() => void loadFixtures()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-accent-gold"
                style={{ border: "1px solid var(--border)" }}
              >
                <RefreshCw size={13} /> Retry
              </button>
            </GlassPanel>
          ) : dayFixtures.length === 0 ? (
            <GlassPanel className="py-12 text-center">
              <p className="text-sm font-semibold text-foreground">No matches on this date</p>
              <p className="mt-1 text-xs text-foreground-muted">এই তারিখে কোনো ম্যাচ নেই</p>
            </GlassPanel>
          ) : (
            dayFixtures.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                isLive={isFixtureLive(match)}
                stadium={match.league_name}
                format={match.sport}
                onSetReminder={handleReminder}
              />
            ))
          )}
        </section>
      </div>
    </ViewerPageShell>
  );
}
