"use client";

import Link from "next/link";
import {
  Calendar,
  ChevronRight,
  Clock,
  Radio,
  RefreshCw,
  TrendingUp,
  Tv2,
} from "lucide-react";
import { MatchCard } from "@/components/matches/MatchCard";
import { QuickStatCard } from "@/components/ui/QuickStatCard";
import { isFixtureLive } from "@/lib/matchPresentation";
import type { Channel, LiveFixture, ViewerModule } from "@/lib/types";

type CountryTab = {
  id: ViewerModule | "more";
  label: string;
  icon: string;
};

type Props = {
  live: LiveFixture[];
  upcoming: LiveFixture[];
  featured: LiveFixture | null;
  totalChannels: number;
  continueWatching: Channel[];
  trendingChannels: Channel[];
  countryModules: CountryTab[];
  fixturesLoading: boolean;
  fixturesError?: boolean;
  onSelectChannel: (ch: Channel) => void;
  onSelectModule: (m: ViewerModule | "more") => void;
  onOpenLiveCenter: () => void;
  onRefreshFixtures: () => void;
};

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
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-premium overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-bold font-bengali" style={{ color: "var(--text-main)" }}>{title}</h2>
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
}: {
  title: string;
  icon: React.ReactNode;
  channels: Channel[];
  onSelect: (ch: Channel) => void;
}) {
  if (channels.length === 0) return null;
  return (
    <SectionShell title={title} icon={icon}>
      <div className="flex gap-2 overflow-x-auto p-3 scrollbar-none" data-swipe-ignore="true">
        {channels.map((ch) => (
          <ChannelChip key={ch.id} ch={ch} onSelect={() => onSelect(ch)} isLive={ch.module === "live_matches"} />
        ))}
      </div>
    </SectionShell>
  );
}

export function HomeSportsDashboard({
  live,
  upcoming,
  featured,
  totalChannels,
  continueWatching,
  trendingChannels,
  countryModules,
  fixturesLoading,
  fixturesError,
  onSelectChannel,
  onSelectModule,
  onOpenLiveCenter,
  onRefreshFixtures,
}: Props) {
  const featuredIsLive = featured ? isFixtureLive(featured) : false;
  const hasStats = totalChannels > 0 || live.length > 0 || upcoming.length > 0;

  return (
    <section className="space-y-4" aria-label="Sports dashboard">
      <ChannelRow
        title="Continue Watching"
        icon={<Clock size={16} style={{ color: "var(--primary-accent)" }} aria-hidden />}
        channels={continueWatching.slice(0, 10)}
        onSelect={onSelectChannel}
      />

      {live.length > 0 && (
        <SectionShell
          title="Live Now"
          icon={<Radio size={16} className="text-red-400" aria-hidden />}
          action={
            <button type="button" onClick={onOpenLiveCenter} className="flex items-center gap-0.5 text-[11px] font-semibold text-accent-gold">
              Match Center <ChevronRight size={14} />
            </button>
          }
        >
          <div className="flex gap-3 overflow-x-auto p-3 scrollbar-none" data-swipe-ignore="true">
            {fixturesLoading ? (
              <p className="px-1 text-xs" style={{ color: "var(--text-muted)" }}>Loading…</p>
            ) : fixturesError ? (
              <div className="flex w-full flex-col items-center gap-2 py-4 text-center">
                <button type="button" onClick={onRefreshFixtures} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-accent-gold" style={{ border: "1px solid var(--border)" }}>
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            ) : (
              live.slice(0, 8).map((fx) => (
                <div key={fx.id} className="shrink-0" style={{ width: 280 }}>
                  <MatchCard match={fx} isLive stadium={fx.league_name} format={fx.sport} />
                </div>
              ))
            )}
          </div>
        </SectionShell>
      )}

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
            {featuredIsLive ? "Featured Live Match" : "Featured Match"}
          </p>
          <p className="mt-1 text-base font-bold font-bengali" style={{ color: "var(--text-main)" }}>
            {featured.home_team} vs {featured.away_team}
          </p>
          <p className="mt-0.5 text-xs font-bengali" style={{ color: "var(--text-muted)" }}>
            {featured.league_name}{featured.status ? ` · ${featured.status}` : ""}
          </p>
        </Link>
      )}

      <SectionShell title="Categories" icon={<TrendingUp size={16} className="text-accent-cyan" aria-hidden />}>
        <div className="grid grid-cols-5 gap-2 p-3">
          {countryModules.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectModule(m.id)}
              className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl py-3.5 transition active:scale-95 hover:border-accent-gold/25"
              style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
            >
              <span className="text-xl leading-none" aria-hidden>{m.icon}</span>
              <span className="w-full truncate text-center text-[10px] font-semibold font-bengali leading-tight px-0.5 sm:text-[11px]" style={{ color: "var(--text-main)" }}>{m.label}</span>
            </button>
          ))}
        </div>
      </SectionShell>

      <ChannelRow
        title="Trending Sports"
        icon={<TrendingUp size={16} style={{ color: "#22d3ee" }} aria-hidden />}
        channels={trendingChannels.slice(0, 12)}
        onSelect={onSelectChannel}
      />

      {hasStats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {totalChannels > 0 && (
            <QuickStatCard label="Total Channels" value={totalChannels} icon={<Tv2 size={16} />} accent="gold" />
          )}
          {live.length > 0 && (
            <QuickStatCard label="Live Now" value={live.length} icon={<Radio size={16} />} accent="red" onClick={onOpenLiveCenter} />
          )}
          {upcoming.length > 0 && (
            <QuickStatCard label="Upcoming" value={upcoming.length} icon={<Calendar size={16} />} accent="gold" onClick={onOpenLiveCenter} />
          )}
        </div>
      )}
    </section>
  );
}
