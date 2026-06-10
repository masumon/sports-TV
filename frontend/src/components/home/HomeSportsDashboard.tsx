"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Clock, Radio, RefreshCw, Tv2 } from "lucide-react";
import { MatchCard } from "@/components/matches/MatchCard";
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
  featured: LiveFixture | null;
  popularChannels: Channel[];
  continueWatching: Channel[];
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
    <div className="flex shrink-0 flex-col gap-2 rounded-xl p-3 animate-pulse" style={{ width: 260, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="h-3 w-3/4 rounded" style={{ background: "var(--bg-hover)" }} />
      <div className="h-3 w-1/2 rounded" style={{ background: "var(--bg-hover)" }} />
    </div>
  );
}

function ChannelChip({ ch, onSelect }: { ch: Channel; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-2 py-2 transition active:scale-95"
      style={{ width: 72, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
      title={ch.name}
    >
      {ch.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ch.logo_url} alt="" className="h-11 w-11 rounded-lg object-contain bg-white" loading="lazy" />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-lg text-xs font-bold" style={{ background: "var(--bg-hover)", color: "var(--primary-accent)" }}>
          {ch.name.slice(0, 2)}
        </div>
      )}
      <p className="w-full truncate text-[9px] font-medium" style={{ color: "var(--text-muted)" }}>{ch.name}</p>
    </button>
  );
}

export function HomeSportsDashboard({
  live,
  upcoming,
  featured,
  popularChannels,
  continueWatching,
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
      {/* 1. Live Now */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-red-400" aria-hidden />
            <h2 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Live Now</h2>
            {live.length > 0 && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
                {live.length}
              </span>
            )}
          </div>
          <button type="button" onClick={onOpenLiveCenter} className="flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: "var(--primary-accent)" }}>
            Match Center <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto p-3 scrollbar-none" data-swipe-ignore="true">
          {fixturesLoading && live.length === 0 ? (
            <>
              <MatchRowSkeleton />
              <MatchRowSkeleton />
            </>
          ) : fixturesError ? (
            <div className="flex w-full flex-col items-center gap-2 py-4 text-center">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Could not load matches</p>
              <button type="button" onClick={onRefreshFixtures} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ color: "var(--primary-accent)", border: "1px solid var(--border)" }}>
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          ) : live.length === 0 ? (
            <p className="px-1 py-2 text-xs" style={{ color: "var(--text-muted)" }}>No live matches right now — check upcoming below.</p>
          ) : (
            live.slice(0, 8).map((fx) => (
              <div key={fx.id} className="shrink-0" style={{ width: 280 }}>
                <MatchCard match={fx} isLive stadium={fx.league_name} format={fx.sport} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Featured Match */}
      {featured && (
        <Link
          href={`/match/${featured.id}` as `/match/${string}`}
          className="block rounded-2xl p-4 transition active:scale-[0.99]"
          style={{
            background: featuredIsLive
              ? "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(245,166,35,0.08))"
              : "var(--bg-card)",
            border: `1px solid ${featuredIsLive ? "rgba(239,68,68,0.25)" : "var(--border)"}`,
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: featuredIsLive ? "#f87171" : "var(--primary-accent)" }}>
            {featuredIsLive ? "Featured · Live" : "Featured Match"}
          </p>
          <p className="mt-1 text-base font-bold" style={{ color: "var(--text-main)" }}>
            {featured.home_team} vs {featured.away_team}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
            {featured.league_name} · {featured.status || "Scheduled"}
          </p>
        </Link>
      )}

      {/* 3–6: deferred below-fold sections */}
      {showDeferred && (
        <>
          {upcoming.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <h2 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Upcoming Matches</h2>
              </div>
              <div className="flex gap-3 overflow-x-auto p-3 scrollbar-none" data-swipe-ignore="true">
                {upcoming.slice(0, 6).map((fx) => (
                  <div key={fx.id} className="shrink-0" style={{ width: 260 }}>
                    <MatchCard match={fx} stadium={fx.league_name} format={fx.sport} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {popularChannels.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <Tv2 size={16} style={{ color: "var(--primary-accent)" }} aria-hidden />
                <h2 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Popular Sports Channels</h2>
              </div>
              <div className="flex gap-2 overflow-x-auto p-3 scrollbar-none" data-swipe-ignore="true">
                {popularChannels.map((ch) => (
                  <ChannelChip key={ch.id} ch={ch} onSelect={() => onSelectChannel(ch)} />
                ))}
              </div>
            </div>
          )}

          {continueWatching.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <Clock size={16} style={{ color: "var(--primary-accent)" }} aria-hidden />
                <h2 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Continue Watching</h2>
              </div>
              <div className="flex gap-2 overflow-x-auto p-3 scrollbar-none" data-swipe-ignore="true">
                {continueWatching.slice(0, 10).map((ch) => (
                  <ChannelChip key={ch.id} ch={ch} onSelect={() => onSelectChannel(ch)} />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Browse by Region</h2>
            </div>
            <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-6">
              {countryModules.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectModule(m.id)}
                  className="flex flex-col items-center gap-1 rounded-xl py-3 transition active:scale-95"
                  style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
                >
                  <span className="text-xl" aria-hidden>{m.icon}</span>
                  <span className="text-[10px] font-semibold" style={{ color: "var(--text-main)" }}>{m.label}</span>
                  {m.count > 0 && (
                    <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{m.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
