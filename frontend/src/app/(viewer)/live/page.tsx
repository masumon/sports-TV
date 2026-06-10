"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  const [error, setError] = useState<string | null>(null);

  const loadFixtures = useCallback(async () => {
    setFixturesLoading(true);
    setError(null);
    try {
      const fixtureRes = await apiClient.getLiveFixtures({ hours_back: 6, days_ahead: 2 });
      setFixtures(fixtureRes.items.filter(isFixtureLive));
    } catch {
      setError("Could not load live matches");
      setFixtures([]);
    } finally {
      setFixturesLoading(false);
    }
  }, []);

  const loadChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const catalog = await loadFullCatalogWithLive();
      setChannels(catalog.filter((ch) => ch.module === "live_matches" || ch.is_active).slice(0, 12));
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
  const channelCards = useMemo(
    () => channels.map((ch) => ({ id: ch.id, name: ch.name, logoUrl: ch.logo_url })),
    [channels],
  );

  return (
    <ViewerPageShell>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-heading-1 text-foreground">Live Match Center</h1>
            <p className="mt-1 text-sm text-foreground-secondary">Live streams and matches happening now</p>
          </div>
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
        </header>

        <HeroVideoPlayer
          isLive
          title={featured ? `${featured.home_team} vs ${featured.away_team}` : "Live sports"}
          overlay={
            featured ? (
              <LiveStatsOverlay
                homeTeam={featured.home_team}
                awayTeam={featured.away_team}
                period={featured.status}
                venue={featured.league_name}
                format={featured.sport}
                series={featured.league_name}
              />
            ) : undefined
          }
        >
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Match preview</p>
            <p className="text-sm text-white/80">Tap a channel below or open home to watch live TV</p>
            {featured?.thumb_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={featured.thumb_url} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40" />
            ) : null}
          </div>
        </HeroVideoPlayer>

        <section className="space-y-3">
          <h2 className="text-heading-2 text-foreground">Live Matches</h2>
          {fixturesLoading && fixtures.length === 0 ? (
            <div className="space-y-2">
              <div className="h-24 animate-pulse rounded-2xl bg-surface-elevated" />
              <div className="h-24 animate-pulse rounded-2xl bg-surface-elevated" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-border-subtle bg-surface-secondary p-6 text-center">
              <p className="text-sm text-foreground-muted">{error}</p>
              <button
                type="button"
                onClick={() => void loadFixtures()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-accent-gold"
                style={{ border: "1px solid var(--border)" }}
              >
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          ) : fixtures.length === 0 ? (
            <div className="rounded-2xl border border-border-subtle bg-surface-secondary p-6 text-center">
              <p className="text-sm text-foreground-muted">No live matches right now.</p>
              <Link href="/sports" className="mt-2 inline-block text-xs font-semibold text-accent-cyan hover:text-accent-gold">
                View upcoming schedule →
              </Link>
            </div>
          ) : (
            fixtures.slice(0, 8).map((match) => (
              <MatchCard key={match.id} match={match} isLive stadium={match.league_name} format={match.sport} />
            ))
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-heading-2 text-foreground">Live Channels</h2>
            <Link href="/" className="text-xs font-semibold text-accent-cyan hover:text-accent-gold">
              View all →
            </Link>
          </div>
          {channelsLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-elevated" />
              ))}
            </div>
          ) : channelCards.length === 0 ? (
            <p className="text-sm text-foreground-muted">No channels available.</p>
          ) : (
            <ChannelGrid
              channels={channelCards}
              isLive
              onSelect={(card) => router.push(`/?channel_id=${card.id}`)}
            />
          )}
        </section>
      </div>
    </ViewerPageShell>
  );
}
