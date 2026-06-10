"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ViewerPageShell } from "@/components/layout/ViewerPageShell";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { MatchCalendar } from "@/components/matches/MatchCalendar";
import { MatchCard } from "@/components/matches/MatchCard";
import { apiClient } from "@/lib/apiClient";
import { useI18n } from "@/lib/i18n/LocaleContext";
import {
  fixtureDateKey,
  FIXTURE_HOURS_BACK,
  groupFixtures,
  isFixtureLive,
} from "@/lib/matchPresentation";
import type { LiveFixture } from "@/lib/types";

type HubTab = "live" | "upcoming" | "recent_results" | "archive";

export default function SportsPage() {
  const { locale } = useI18n();
  const [hubTab, setHubTab] = useState<HubTab>("live");
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
      const res = await apiClient.getLiveFixtures({ hours_back: FIXTURE_HOURS_BACK, days_ahead: 14 });
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

  const groups = useMemo(() => groupFixtures(fixtures), [fixtures]);

  const datesWithMatches = useMemo(
    () => [...new Set(fixtures.map(fixtureDateKey).filter(Boolean))],
    [fixtures],
  );

  const selectedKey = selectedDate.toISOString().slice(0, 10);
  const dayFixtures = useMemo(
    () => fixtures.filter((fx) => fixtureDateKey(fx) === selectedKey),
    [fixtures, selectedKey],
  );

  const hubItems = useMemo(() => {
    if (hubTab === "live") return groups.live;
    if (hubTab === "upcoming") return groups.upcoming;
    if (hubTab === "recent_results") return groups.recentResults;
    return dayFixtures;
  }, [hubTab, groups, dayFixtures]);

  const shiftWeek = (direction: -1 | 1) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + direction * 7);
      return next;
    });
  };

  const browseNearbyDate = (offset: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + offset);
      return next;
    });
    setHubTab("archive");
  };

  const handleReminder = (match: LiveFixture) => {
    toast.success(`Reminder set: ${match.home_team} vs ${match.away_team}`);
  };

  const tabs: { id: HubTab; label: string; count: number }[] = [
    { id: "live", label: "Live", count: groups.live.length },
    { id: "upcoming", label: "Upcoming", count: groups.upcoming.length },
    { id: "recent_results", label: "Recent Results", count: groups.recentResults.length },
    { id: "archive", label: "Calendar", count: dayFixtures.length },
  ];

  return (
    <ViewerPageShell>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-heading-1 font-bengali text-foreground">Sports Hub</h1>
            <p className="mt-1 text-sm text-foreground-secondary">Live · Upcoming · Recent Results · Historical Archive</p>
          </div>
          <button
            type="button"
            onClick={() => void loadFixtures()}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground-muted glass-premium"
            aria-label="Refresh schedule"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        <div className="cat-tab-row scrollbar-none" data-swipe-ignore="true">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setHubTab(tab.id)}
              className={`cat-tab${hubTab === tab.id ? " active" : ""}`}
            >
              {tab.label}
              {tab.count > 0 ? <span className="module-tab-badge">{tab.count}</span> : null}
            </button>
          ))}
        </div>

        {hubTab === "archive" && (
          <MatchCalendar
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            fixtures={fixtures}
            datesWithMatches={datesWithMatches}
            locale={locale}
            onPrevWeek={() => shiftWeek(-1)}
            onNextWeek={() => shiftWeek(1)}
          />
        )}

        <section className="space-y-3">
          <h2 className="text-heading-2 text-foreground">
            {hubTab === "live" ? "Live Matches" : hubTab === "upcoming" ? "Upcoming Fixtures" : hubTab === "recent_results" ? "Last 5 Days Results" : "Matches on Selected Date"}
          </h2>
          {loading && fixtures.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl skeleton-shimmer" />
              ))}
            </div>
          ) : error ? (
            <GlassPanel variant="premium" className="py-10 text-center">
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
          ) : fixtures.length === 0 ? (
            <GlassPanel variant="premium" className="py-12 text-center">
              <p className="text-sm font-semibold text-foreground">No matches in schedule</p>
              <p className="mt-1 text-xs text-foreground-muted">
                Configure fixture sync in admin or set API tokens to load sports data.
              </p>
            </GlassPanel>
          ) : hubItems.length === 0 ? (
            <GlassPanel variant="premium" className="py-12 text-center">
              <Calendar size={28} className="mx-auto mb-3 text-foreground-muted" aria-hidden />
              <p className="text-sm font-semibold text-foreground">
                {hubTab === "archive" ? "No matches on this date" : "Nothing here right now"}
              </p>
              <p className="mt-1 text-xs text-foreground-muted font-bengali">
                Browse nearby dates or view recent results
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => browseNearbyDate(-1)} className="cat-tab">Previous day</button>
                <button type="button" onClick={() => browseNearbyDate(1)} className="cat-tab">Next day</button>
                <button type="button" onClick={() => setHubTab("recent_results")} className="cat-tab active">Recent Results</button>
              </div>
            </GlassPanel>
          ) : (
            hubItems.map((match) => (
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

        {groups.recentResults.length > 0 && hubTab !== "recent_results" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-heading-2 text-foreground">Recent Results</h2>
              <button type="button" onClick={() => setHubTab("recent_results")} className="flex items-center gap-0.5 text-xs font-semibold text-accent-gold">
                View all <ChevronRight size={14} />
              </button>
            </div>
            {groups.recentResults.slice(0, 3).map((match) => (
              <MatchCard key={match.id} match={match} stadium={match.league_name} format={match.sport} />
            ))}
          </section>
        )}

        <p className="text-center text-xs text-foreground-muted">
          <Link href="/" className="text-accent-cyan hover:text-accent-gold">← Back to Live TV</Link>
        </p>
      </div>
    </ViewerPageShell>
  );
}
