"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fixtureRes, catalog] = await Promise.all([
        apiClient.getLiveFixtures({ hours_back: 6, days_ahead: 2 }),
        loadFullCatalogWithLive(),
      ]);
      setFixtures(fixtureRes.items.filter(isFixtureLive));
      setChannels(catalog.filter((ch) => ch.module === "live_matches" || ch.is_active).slice(0, 12));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const featured = fixtures[0];
  const channelCards = useMemo(
    () => channels.map((ch) => ({ id: ch.id, name: ch.name, logoUrl: ch.logo_url })),
    [channels],
  );

  return (
    <ViewerPageShell>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header>
          <h1 className="text-heading-1 text-foreground">Live Now</h1>
          <p className="mt-1 text-sm text-foreground-secondary">সরাসরি স্ট্রিম ও লাইভ ম্যাচ</p>
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
          {featured?.thumb_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={featured.thumb_url} alt="" className="h-full w-full object-cover" />
          ) : null}
        </HeroVideoPlayer>

        <section className="space-y-3">
          <h2 className="text-heading-2 text-foreground">Live Matches</h2>
          {loading ? (
            <div className="h-24 animate-pulse rounded-2xl bg-surface-elevated" />
          ) : fixtures.length === 0 ? (
            <p className="text-sm text-foreground-muted">No live matches right now.</p>
          ) : (
            fixtures.slice(0, 6).map((match) => (
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
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-elevated" />
              ))}
            </div>
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
