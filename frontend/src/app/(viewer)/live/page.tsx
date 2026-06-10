"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { ViewerPageShell } from "@/components/layout/ViewerPageShell";
import { HeroVideoPlayer } from "@/components/player/HeroVideoPlayer";
import { LiveStatsOverlay } from "@/components/player/LiveStatsOverlay";
import { ChannelGrid } from "@/components/channels/ChannelGrid";
import { MatchCard } from "@/components/matches/MatchCard";
import { apiClient } from "@/lib/apiClient";
import { loadFullCatalogWithLive } from "@/lib/streamCatalog";
import { isFixtureLive } from "@/lib/matchPresentation";
import type { Channel, LiveFixture } from "@/lib/types";

export default function LivePage() {
  const router = useRouter();
  const [fixtures, setFixtures] = useState<LiveFixture[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [fixturesLoading, setFixturesLoading] = useState(true);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadFixtures = useCallback(async () => {
    setFixturesLoading(true);
    setError(null);
    try {
      const fixtureRes = await apiClient.getLiveFixtures({ hours_back: 6, days_ahead: 2 });
      setFixtures(fixtureRes.items.filter(isFixtureLive));
    } catch {
      setError("load_failed");
      setFixtures([]);
    } finally {
      setFixturesLoading(false);
    }
  }, []);

  const loadChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const catalog = await loadFullCatalogWithLive();
      setChannels(catalog.filter((ch) => ch.module === "live_matches" || ch.is_active));
    } catch {
      setChannels([]);
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    void loadChannels();
    await loadFixtures();
  }, [loadFixtures, loadChannels]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) void loadFixtures();
    }, 90_000);
    return () => clearInterval(id);
  }, [loadFixtures]);

  const featured = fixtures[0];
  const countryOptions = useMemo(
    () => [...new Set(channels.map((c) => c.country.trim()).filter(Boolean))].sort(),
    [channels],
  );
  const filteredChannels = useMemo(
    () => (filterCountry ? channels.filter((c) => c.country === filterCountry) : channels).slice(0, 24),
    [channels, filterCountry],
  );
  const channelCards = useMemo(
    () => filteredChannels.map((ch) => ({ id: ch.id, name: ch.name, logoUrl: ch.logo_url })),
    [filteredChannels],
  );

  return (
    <ViewerPageShell>
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-heading-1 text-foreground">Live Match Center</h1>
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground-muted transition hover:text-accent-gold"
            style={{ border: "1px solid var(--border)" }}
            aria-label="Refresh"
          >
            <RefreshCw size={14} className={fixturesLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {featured && (
          <section className="space-y-3">
            <HeroVideoPlayer
              isLive
              title={`${featured.home_team} vs ${featured.away_team}`}
              overlay={
                <LiveStatsOverlay
                  homeTeam={featured.home_team}
                  awayTeam={featured.away_team}
                  period={featured.status}
                  venue={featured.league_name}
                  format={featured.sport}
                  series={featured.league_name}
                />
              }
            >
              {featured.thumb_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={featured.thumb_url} alt="" className="h-full w-full object-cover" />
              ) : null}
            </HeroVideoPlayer>
            <MatchCard match={featured} isLive stadium={featured.league_name} format={featured.sport} />
          </section>
        )}

        {error && fixtures.length === 0 && (
          <button
            type="button"
            onClick={() => void loadFixtures()}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-accent-gold"
            style={{ border: "1px solid var(--border)" }}
          >
            <RefreshCw size={13} /> Retry
          </button>
        )}

        {countryOptions.length > 0 && (
          <div className="filter-chip-row" data-swipe-ignore="true">
            <button
              type="button"
              className={`filter-chip${filterCountry === "" ? " active" : ""}`}
              onClick={() => setFilterCountry("")}
            >
              All Countries
            </button>
            {countryOptions.map((c) => (
              <button
                key={c}
                type="button"
                className={`filter-chip${filterCountry === c ? " active" : ""}`}
                onClick={() => setFilterCountry(filterCountry === c ? "" : c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-heading-2 text-foreground">Live Channels</h2>
          {channelsLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-elevated" />
              ))}
            </div>
          ) : channelCards.length > 0 ? (
            <ChannelGrid
              channels={channelCards}
              isLive
              onSelect={(card) => router.push(`/?channel_id=${card.id}`)}
            />
          ) : null}
        </section>
      </div>
    </ViewerPageShell>
  );
}
