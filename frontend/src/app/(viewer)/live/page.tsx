"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ViewerPageShell } from "@/components/layout/ViewerPageShell";
import { HeroVideoPlayer } from "@/components/player/HeroVideoPlayer";
import { ChannelGrid } from "@/components/channels/ChannelGrid";
import { MatchCard } from "@/components/matches/MatchCard";
import { apiClient, fetchDbChannelsForMerge } from "@/lib/apiClient";
import { loadFullCatalogWithLive } from "@/lib/streamCatalog";
import { orderedStreamUrlsForChannel } from "@/lib/channelStreams";
import { mergeDbChannelsIntoViewerCatalog, viewerCatalogFromDbChannels } from "@/lib/viewerCatalogMerge";
import { sortByBdPriority } from "@/lib/bdPriority";
import { isFixtureLive } from "@/lib/matchPresentation";
import type { Channel, LiveFixture } from "@/lib/types";

const PremiumPlayer = dynamic(
  () => import("@/components/PremiumPlayer").then((m) => m.default),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-black/80" /> },
);

export default function LivePage() {
  const [fixtures, setFixtures] = useState<LiveFixture[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [fixturesLoading, setFixturesLoading] = useState(true);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
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
      const db = await fetchDbChannelsForMerge({}, true).catch(() => [] as Channel[]);
      if (db.length > 0) {
        setChannels(
          viewerCatalogFromDbChannels(db).filter((ch) => ch.module === "live_matches" || ch.is_active),
        );
        setChannelsLoading(false);
      }
      const catalog = await loadFullCatalogWithLive();
      const merged = mergeDbChannelsIntoViewerCatalog(catalog, db);
      setChannels(merged.filter((ch) => ch.module === "live_matches" || ch.is_active));
    } catch {
      /* keep DB snapshot if M3U leg fails */
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
  const featuredChannel = featured?.suggested_channels?.[0];
  const selectedChannel = useMemo(
    () => channels.find((ch) => ch.id === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  );
  const playbackChannel = selectedChannel ?? featuredChannel ?? null;
  const playbackTitle = selectedChannel
    ? selectedChannel.name
    : featured
    ? `${featured.home_team} vs ${featured.away_team}`
    : "Live TV";
  const playbackUrls = useMemo(
    () => (playbackChannel ? orderedStreamUrlsForChannel(playbackChannel) : []),
    [playbackChannel],
  );

  const countryOptions = useMemo(
    () => [...new Set(channels.map((c) => c.country.trim()).filter(Boolean))].sort(),
    [channels],
  );
  const filteredChannels = useMemo(
    () =>
      sortByBdPriority(
        filterCountry ? channels.filter((c) => c.country === filterCountry) : channels,
        (c) => c.name,
      ).slice(0, 24),
    [channels, filterCountry],
  );
  const channelCards = useMemo(
    () => filteredChannels.map((ch) => ({ id: ch.id, name: ch.name, logoUrl: ch.logo_url, geoHint: Boolean(ch.geo_hint) })),
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

        {fixturesLoading && !featured ? (
          <section className="space-y-3">
            <div className="aspect-video animate-pulse rounded-2xl bg-surface-elevated" />
            <div className="h-32 animate-pulse rounded-2xl bg-surface-elevated" />
          </section>
        ) : null}

        {featured || selectedChannel ? (
          <section className="space-y-3">
            <HeroVideoPlayer
              isLive
              title={playbackTitle}
            >
              {playbackChannel && playbackUrls.length > 0 ? (
                <PremiumPlayer
                  key={playbackChannel.id}
                  streamUrl={playbackUrls[0] ?? playbackChannel.stream_url}
                  streamUrls={playbackUrls}
                  title={playbackTitle}
                  isTheaterMode={false}
                  onToggleTheaterMode={() => {}}
                  headerProfile={playbackChannel.header_profile ?? null}
                  geoHint={Boolean(playbackChannel.geo_hint)}
                  channelLogoUrl={playbackChannel.logo_url}
                  isLive
                />
              ) : (
                <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 bg-black/70 px-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Match preview</p>
                  <p className="text-sm text-white/80">Tap a channel below or open home to watch live TV</p>
                  {featured.thumb_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={featured.thumb_url} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40" />
                  ) : null}
                </div>
              )}
            </HeroVideoPlayer>
            {featured ? <MatchCard match={featured} isLive stadium={featured.league_name} format={featured.sport} /> : null}
          </section>
        ) : null}

        {!fixturesLoading && fixtures.length === 0 && !error ? (
          <p className="text-sm text-foreground-muted">No live matches right now. Check back soon.</p>
        ) : null}

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
              activeId={selectedChannelId}
              isLive
              onSelect={(card) => setSelectedChannelId(card.id)}
            />
          ) : null}
        </section>
      </div>
    </ViewerPageShell>
  );
}
