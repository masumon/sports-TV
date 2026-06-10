"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Calendar,
  ChevronRight,
  Clock,
  Radio,
  RefreshCw,
  Star,
  TrendingUp,
  Tv2,
  Users,
} from "lucide-react";
import { MatchCard } from "@/components/matches/MatchCard";
import { QuickStatCard } from "@/components/ui/QuickStatCard";
import { isFixtureLive } from "@/lib/matchPresentation";
import type { Channel, LiveFixture, ViewerModule } from "@/lib/types";

type CountryTab = {
  id: ViewerModule;
  label: string;
  icon: string;
  count: number;
};

type Props = {
  live: LiveFixture[];
  upcoming: LiveFixture[];
  recentResults: LiveFixture[];
  featured: LiveFixture | null;
  totalChannels: number;
  watchingNow: number;
  popularChannels: Channel[];
  continueWatching: Channel[];
  favorites: Channel[];
  trendingChannels: Channel[];
  recentlyWatched: Channel[];
  recommendedChannels: Channel[];
  countryModules: CountryTab[];
  fixturesLoading: boolean;
  fixturesError?: boolean;
  onSelectChannel: (ch: Channel) => void;
  onSelectModule: (m: ViewerModule) => void;
  onOpenLiveCenter: () => void;
  onRefreshFixtures: () => void;
};

function MatchRowSkeleton() {
  return (
    <div className="flex shrink-0 flex-col gap-2 rounded-xl p-3 animate-pulse skeleton-shimmer" style={{ width: 260, border: "1px solid var(--border)" }}>
      <div className="h-3 w-3/4 rounded" style={{ background: "var(--bg-hover)" }} />
      <div className="h-3 w-1/2 rounded" style={{ background: "var(--bg-hover)" }} />
    </div>
  );
}

function ChannelChip({ ch, onSelect, isLive }: { ch: Channel; onSelect: () => void; isLive?: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex shrink-0 flex-col items-center gap-2 rounded-2xl px-2.5 py-2.5 transition active:scale-95 hover:border-accent-gold/30"
      style={{ width: 80, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
      title={ch.name}
    >
      <div className="relative">
        {ch.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ch.logo_url} alt="" className="h-12 w-12 rounded-xl object-contain bg-white p-0.5 sm:h-14 sm:w-14" loading="lazy" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl text-xs font-bold sm:h-14 sm:w-14" style={{ background: "var(--bg-hover)", color: "var(--primary-accent)" }}>
            {ch.name.slice(0, 2)}
          </div>
        )}
        {isLive ? (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-live-red live-pulse" aria-hidden />
        ) : null}
      </div>
      <p className="w-full truncate text-[10px] font-medium leading-tight" style={{ color: "var(--text-muted)" }}>{ch.name}</p>
    </button>
  );
}

function SectionShell({
  title,
  icon,
  badge,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-premium overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-bold font-bengali" style={{ color: "var(--text-main)" }}>{title}</h2>
          {badge ? (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(245,166,35,0.12)", color: "var(--primary-accent)" }}>
              {badge}
            </span>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ChannelRow({
  title,
  icon,
  channels,
  onSelect,
  badge,
}: {
  title: string;
  icon: React.ReactNode;
  channels: Channel[];
  onSelect: (ch: Channel) => void;
  badge?: string;
}) {
  if (channels.length === 0) return null;
  return (
    <SectionShell title={title} icon={icon} badge={badge}>
      <div className="flex gap-2 overflow-x-auto p-3 scrollbar-none" data-swipe-ignore="true">
        {channels.map((ch) => (
          <ChannelChip key={ch.id} ch={ch} onSelect={() => onSelect(ch)} isLive={ch.module === "live_matches"} />
        ))}
      </div>
    </SectionShell>
  );
}

function LiveEmptyState({
  upcoming,
  recentResults,
  featured,
  onOpenLiveCenter,
}: {
  upcoming: LiveFixture[];
  recentResults: LiveFixture[];
  featured: LiveFixture | null;
  onOpenLiveCenter: () => void;
}) {
  return (
    <div className="space-y-3 p-3">
      <p className="px-1 text-xs font-bengali" style={{ color: "var(--text-muted)" }}>
        No live matches right now — explore upcoming fixtures or recent results.
      </p>
      {featured ? (
        <Link
          href={`/match/${featured.id}` as `/match/${string}`}
          className="block rounded-xl p-3 transition active:scale-[0.99]"
          style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent-gold">Featured Match</p>
          <p className="mt-1 text-sm font-bold">{featured.home_team} vs {featured.away_team}</p>
        </Link>
      ) : null}
      {upcoming.slice(0, 3).map((fx) => (
        <div key={fx.id} className="shrink-0">
          <MatchCard match={fx} stadium={fx.league_name} format={fx.sport} />
        </div>
      ))}
      {recentResults.slice(0, 2).map((fx) => (
        <div key={fx.id} className="shrink-0 opacity-90">
          <MatchCard match={fx} stadium={fx.league_name} format={fx.sport} />
        </div>
      ))}
      <button type="button" onClick={onOpenLiveCenter} className="flex w-full items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-accent-gold" style={{ border: "1px solid var(--border)" }}>
        Open Match Center <ChevronRight size={14} />
      </button>
    </div>
  );
}

export function HomeSportsDashboard({
  live,
  upcoming,
  recentResults,
  featured,
  totalChannels,
  watchingNow,
  popularChannels,
  continueWatching,
  favorites,
  trendingChannels,
  recentlyWatched,
  recommendedChannels,
  countryModules,
  fixturesLoading,
  fixturesError,
  onSelectChannel,
  onSelectModule,
  onOpenLiveCenter,
  onRefreshFixtures,
}: Props) {
  const [showDeferred, setShowDeferred] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowDeferred(true), 0);
    return () => clearTimeout(t);
  }, []);

  const featuredIsLive = featured ? isFixtureLive(featured) : false;

  return (
    <section className="space-y-4" aria-label="Sports dashboard">
      {/* 1. Hero */}
      {featured && (
        <Link
          href={`/match/${featured.id}` as `/match/${string}`}
          className="glass-premium block rounded-2xl p-4 transition active:scale-[0.99]"
          style={{
            background: featuredIsLive
              ? "linear-gradient(135deg, rgba(239,68,68,0.14), rgba(20,20,30,0.35))"
              : undefined,
            borderColor: featuredIsLive ? "rgba(239,68,68,0.3)" : undefined,
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: featuredIsLive ? "#f87171" : "var(--primary-accent)" }}>
            {featuredIsLive ? "Hero Live Match" : "Featured Match"}
          </p>
          <p className="mt-1 text-base font-bold font-bengali" style={{ color: "var(--text-main)" }}>
            {featured.home_team} vs {featured.away_team}
          </p>
          <p className="mt-0.5 text-xs font-bengali" style={{ color: "var(--text-muted)" }}>
            {featured.league_name} · {featured.status || "Scheduled"}
          </p>
        </Link>
      )}

      {/* 2. Quick Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <QuickStatCard label="Total Channels" value={totalChannels} icon={<Tv2 size={16} />} accent="gold" />
        <QuickStatCard label="Watching Now" value={watchingNow || "—"} icon={<Users size={16} />} accent="cyan" />
        <QuickStatCard label="Live Sports" value={live.length} icon={<Radio size={16} />} accent="red" onClick={onOpenLiveCenter} />
        <QuickStatCard label="Upcoming" value={upcoming.length} icon={<Calendar size={16} />} accent="gold" onClick={onOpenLiveCenter} />
      </div>

      {/* 3. Categories */}
      <SectionShell title="Categories" icon={<TrendingUp size={16} className="text-accent-cyan" aria-hidden />}>
        <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-6">
          {countryModules.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectModule(m.id)}
              className="flex flex-col items-center gap-1 rounded-xl py-3 transition active:scale-95 hover:border-accent-gold/25"
              style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
            >
              <span className="text-lg font-bold tabular-nums" style={{ color: "var(--primary-accent)" }}>{m.count > 999 ? "999+" : m.count}</span>
              <span className="text-[10px] font-semibold font-bengali text-center leading-tight px-1" style={{ color: "var(--text-main)" }}>{m.label}</span>
            </button>
          ))}
        </div>
      </SectionShell>

      {/* 4. Continue Watching */}
      <ChannelRow
        title="Continue Watching"
        icon={<Clock size={16} style={{ color: "var(--primary-accent)" }} aria-hidden />}
        channels={continueWatching.slice(0, 10)}
        onSelect={onSelectChannel}
      />

      {/* 5. Popular Channels */}
      <ChannelRow
        title="Popular Channels"
        icon={<Tv2 size={16} style={{ color: "var(--primary-accent)" }} aria-hidden />}
        channels={popularChannels.slice(0, 12)}
        onSelect={onSelectChannel}
        badge="Live"
      />

      {/* 6. Live Sports */}
      <SectionShell
        title="Live Sports"
        icon={<Radio size={16} className="text-red-400" aria-hidden />}
        badge={live.length > 0 ? String(live.length) : undefined}
        action={
          <button type="button" onClick={onOpenLiveCenter} className="flex items-center gap-0.5 text-[11px] font-semibold text-accent-gold">
            Match Center <ChevronRight size={14} />
          </button>
        }
      >
        <div className="flex gap-3 overflow-x-auto p-3 scrollbar-none" data-swipe-ignore="true">
          {fixturesLoading && live.length === 0 ? (
            <>
              <MatchRowSkeleton />
              <MatchRowSkeleton />
            </>
          ) : fixturesError ? (
            <div className="flex w-full flex-col items-center gap-2 py-4 text-center">
              <p className="text-xs font-bengali" style={{ color: "var(--text-muted)" }}>Could not load matches</p>
              <button type="button" onClick={onRefreshFixtures} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-accent-gold" style={{ border: "1px solid var(--border)" }}>
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          ) : live.length === 0 ? (
            <LiveEmptyState upcoming={upcoming} recentResults={recentResults} featured={featured} onOpenLiveCenter={onOpenLiveCenter} />
          ) : (
            live.slice(0, 8).map((fx) => (
              <div key={fx.id} className="shrink-0" style={{ width: 280 }}>
                <MatchCard match={fx} isLive stadium={fx.league_name} format={fx.sport} />
              </div>
            ))
          )}
        </div>
      </SectionShell>

      {showDeferred && (
        <>
          {/* 7. Recent Results (Last 5 Days) */}
          {recentResults.length > 0 && (
            <SectionShell title="Recent Results" icon={<Calendar size={16} className="text-foreground-muted" aria-hidden />} badge="Last 5 days">
              <div className="flex gap-3 overflow-x-auto p-3 scrollbar-none" data-swipe-ignore="true">
                {recentResults.slice(0, 8).map((fx) => (
                  <div key={fx.id} className="shrink-0" style={{ width: 260 }}>
                    <MatchCard match={fx} stadium={fx.league_name} format={fx.sport} />
                  </div>
                ))}
              </div>
            </SectionShell>
          )}

          {/* 8. Recommended */}
          <ChannelRow
            title="Recommended For You"
            icon={<Tv2 size={16} className="text-violet-400" aria-hidden />}
            channels={recommendedChannels.slice(0, 12)}
            onSelect={onSelectChannel}
          />

          {/* Upcoming Matches */}
          {upcoming.length > 0 && (
            <SectionShell title="Upcoming Matches" icon={<Calendar size={16} className="text-accent-gold" aria-hidden />}>
              <div className="flex gap-3 overflow-x-auto p-3 scrollbar-none" data-swipe-ignore="true">
                {upcoming.slice(0, 6).map((fx) => (
                  <div key={fx.id} className="shrink-0" style={{ width: 260 }}>
                    <MatchCard match={fx} stadium={fx.league_name} format={fx.sport} />
                  </div>
                ))}
              </div>
            </SectionShell>
          )}

          <ChannelRow
            title="Favorites"
            icon={<Star size={16} style={{ color: "#F5A623" }} aria-hidden />}
            channels={favorites.slice(0, 12)}
            onSelect={onSelectChannel}
          />

          <ChannelRow
            title="Trending Sports"
            icon={<TrendingUp size={16} style={{ color: "#22d3ee" }} aria-hidden />}
            channels={trendingChannels.slice(0, 12)}
            onSelect={onSelectChannel}
          />

          <ChannelRow
            title="Recently Watched"
            icon={<Clock size={16} className="text-white/50" aria-hidden />}
            channels={recentlyWatched.slice(0, 10)}
            onSelect={onSelectChannel}
          />
        </>
      )}
    </section>
  );
}
