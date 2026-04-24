"use client";

import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  RefreshCw,
  Search,
  Signal,
  Tv2,
  ChevronRight,
  Star,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AdSlot } from "@/components/ads/AdSlot";
import { AppShell } from "@/components/layout/AppShell";
import { ChannelSkeletonGrid } from "@/components/ui/ChannelSkeleton";
import { flagFromCountryName } from "@/components/channel/flagEmoji";
import { fetchAllChannels, apiClient } from "@/lib/apiClient";
import { useI18n } from "@/lib/i18n/LocaleContext";
import type { Channel, LiveScore } from "@/lib/types";
import { usePlayerStore } from "@/store/playerStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";

const LiveScoreOverlay = dynamic(() => import("@/components/LiveScoreOverlay"), { ssr: false });
const PremiumPlayer = dynamic(
  () => import("@/components/PremiumPlayer").then((m) => m.default),
  { ssr: false, loading: () => <div className="player-shell aspect-video animate-pulse" style={{ background: "var(--bg-card)" }} /> }
);

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

const SPORT_ICONS: Record<string, string> = {
  football: "⚽",
  cricket: "🏏",
  basketball: "🏀",
  tennis: "🎾",
  baseball: "⚾",
  rugby: "🏉",
  hockey: "🏒",
  golf: "⛳",
  boxing: "🥊",
  ufc: "🥋",
  racing: "🏎️",
  cycling: "🚴",
  athletics: "🏃",
};

function sportEmoji(category: string): string {
  const key = category.toLowerCase();
  for (const [k, v] of Object.entries(SPORT_ICONS)) {
    if (key.includes(k)) return v;
  }
  return "📺";
}

export function ViewerHome() {
  const { t } = useI18n();
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [activeCategory, setActiveCategory] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [scores, setScores] = useState<LiveScore[]>([]);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const tier = useSubscriptionStore((s) => s.tier);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeChannel = usePlayerStore((state) => state.activeChannel);
  const isTheaterMode = usePlayerStore((state) => state.isTheaterMode);
  const setActiveChannel = usePlayerStore((state) => state.setActiveChannel);
  const toggleTheaterMode = usePlayerStore((state) => state.toggleTheaterMode);

  const loadChannels = useCallback(async (showToast = false, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await fetchAllChannels();
      setAllChannels(data);
      if (showToast && data.length) toast.success(`Loaded ${data.length} channels`);
    } catch (e) {
      if (silent) return;
      const msg = e instanceof Error ? e.message : "Load failed";
      setError(msg);
      toast.error(msg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadChannels(false); }, [loadChannels]);

  useEffect(() => {
    const id = setInterval(() => void loadChannels(false, true), 30 * 60_000);
    return () => clearInterval(id);
  }, [loadChannels]);

  useEffect(() => {
    if (allChannels.length > 0 && !activeChannel) setActiveChannel(allChannels[0]);
  }, [allChannels, activeChannel, setActiveChannel]);

  useEffect(() => {
    const tick = async () => {
      try { setScores(await apiClient.getLiveScores(undefined, 10)); } catch { /* optional */ }
    };
    void tick();
    const id = setInterval(() => void tick(), 15_000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    let list = allChannels;
    const q = deferredSearch.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));
    if (activeCategory) {
      const f = activeCategory.toLowerCase();
      list = list.filter((c) => c.category.toLowerCase().includes(f));
    }
    if (filterCountry) {
      const f = filterCountry.toLowerCase();
      list = list.filter((c) => c.country.toLowerCase().includes(f));
    }
    if (filterLanguage) {
      const f = filterLanguage.toLowerCase();
      list = list.filter((c) => c.language.toLowerCase().includes(f));
    }
    return list;
  }, [allChannels, deferredSearch, activeCategory, filterCountry, filterLanguage]);

  const categoryOptions = useMemo(() => uniqueSorted(allChannels.map((c) => c.category)), [allChannels]);
  const countryOptions = useMemo(() => uniqueSorted(allChannels.map((c) => c.country)), [allChannels]);
  const languageOptions = useMemo(() => uniqueSorted(allChannels.map((c) => c.language)), [allChannels]);

  const liveScoresTicker = useMemo(() => {
    const live = scores.filter((s) => s.status === "live");
    if (live.length === 0) return null;
    return live.map((s) => `${s.team_home} ${s.score_home}–${s.score_away} ${s.team_away} (${s.league})`).join("   •   ");
  }, [scores]);

  return (
    <AppShell searchQuery={searchQuery} onSearch={setSearchQuery}>
      <div className="mx-auto w-full max-w-[1920px] space-y-5">

        {/* ── Live Scores Ticker ── */}
        {liveScoresTicker && (
          <div
            className="flex items-center gap-3 overflow-hidden rounded-xl px-4 py-2.5"
            style={{ background: "var(--bg-card)", border: "1px solid rgb(0 191 255 / 30%)" }}
          >
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--primary-accent)" }}>
              <span className="pulse-dot" />
              LIVE
            </span>
            <div className="marquee-wrap flex-1">
              <span className="marquee-track text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                {liveScoresTicker}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{liveScoresTicker}
              </span>
            </div>
          </div>
        )}

        {/* ── Hero header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="flex items-center gap-2">
              <Tv2 className="h-5 w-5" style={{ color: "var(--primary-accent)" }} />
              <span className="text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "var(--primary-accent)" }}>
                {t("appTitle")}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              {t("tagline")}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {loading ? t("loading") : error ? error : `${allChannels.length} ${t("channels")} · ${filtered.length} ${t("shown")}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search bar */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("search")}
                className="rounded-lg py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid rgb(255 255 255 / 10%)",
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => void loadChannels(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
              style={{ background: "var(--bg-card)", border: "1px solid rgb(255 255 255 / 10%)" }}
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              {t("refresh")}
            </button>

            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: "rgb(0 191 255 / 12%)", border: "1px solid rgb(0 191 255 / 30%)", color: "var(--primary-accent)" }}>
              <Signal size={12} /> {t("hlsLive")}
            </div>

            {tier === "premium" && (
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: "rgb(251 191 36 / 15%)", border: "1px solid rgb(251 191 36 / 30%)", color: "#fbbf24" }}>
                <Star size={12} fill="currentColor" /> {t("premium")}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── AdSlot banner ── */}
        {tier === "free" && <AdSlot variant="banner" />}

        {/* ── Category tabs ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            className={`cat-tab${activeCategory === "" ? " active" : ""}`}
            onClick={() => setActiveCategory("")}
          >
            📺 All
          </button>
          {categoryOptions.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`cat-tab${activeCategory === cat ? " active" : ""}`}
              onClick={() => setActiveCategory(activeCategory === cat ? "" : cat)}
            >
              {sportEmoji(cat)} {cat}
            </button>
          ))}
        </div>

        {/* ── Advanced filters toggle ── */}
        <div>
          <button
            type="button"
            onClick={() => setShowAllFilters((v) => !v)}
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <Globe size={13} />
            {showAllFilters ? t("hideFilters") : t("moreFilters")}
            <ChevronRight size={13} className={`transition-transform ${showAllFilters ? "rotate-90" : ""}`} />
          </button>
          <AnimatePresence>
            {showAllFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 flex flex-wrap gap-2 rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid rgb(255 255 255 / 7%)" }}>
                  <select
                    aria-label={t("allCountries")}
                    value={filterCountry}
                    onChange={(e) => setFilterCountry(e.target.value)}
                    className="quality-select"
                  >
                    <option value="">{t("allCountries")}</option>
                    {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    aria-label={t("allLanguages")}
                    value={filterLanguage}
                    onChange={(e) => setFilterLanguage(e.target.value)}
                    className="quality-select"
                  >
                    <option value="">{t("allLanguages")}</option>
                    {languageOptions.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Main grid: player + channel list ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

          {/* Player */}
          <section className="lg:col-span-8 xl:col-span-8">
            {activeChannel ? (
              <PremiumPlayer
                streamUrl={activeChannel.stream_url}
                title={activeChannel.name}
                isTheaterMode={isTheaterMode}
                onToggleTheaterMode={toggleTheaterMode}
                overlay={<LiveScoreOverlay scores={scores} />}
              />
            ) : (
              <div className="player-shell flex aspect-video items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
                {t("noChannel")}
              </div>
            )}

            {/* Now playing info strip */}
            {activeChannel && (
              <motion.div
                key={activeChannel.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ background: "var(--bg-card)", border: "1px solid rgb(255 255 255 / 7%)" }}
              >
                {activeChannel.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={activeChannel.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" style={{ border: "1px solid rgb(255 255 255 / 10%)" }} />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: "var(--primary-accent)" }}>
                    {activeChannel.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-widest" style={{ color: "var(--primary-accent)" }}>{t("nowPlaying")}</p>
                  <p className="truncate text-sm font-bold text-white">{activeChannel.name}</p>
                  <p className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>{flagFromCountryName(activeChannel.country)}</span>
                    <span>{activeChannel.country} · {activeChannel.category} · {activeChannel.quality_tag.toUpperCase()}</span>
                  </p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgb(0 191 255 / 15%)", color: "var(--primary-accent)", border: "1px solid rgb(0 191 255 / 35%)" }}>
                  <span className="pulse-dot" style={{ width: 6, height: 6 }} /> LIVE
                </span>
              </motion.div>
            )}
          </section>

          {/* Sidebar: upcoming channels */}
          <aside className="flex flex-col gap-3 lg:col-span-4 xl:col-span-4">
            {tier === "free" && <AdSlot variant="inline" />}

            {/* Featured channels quick list */}
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid rgb(255 255 255 / 7%)" }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgb(255 255 255 / 7%)" }}>
                <h2 className="text-sm font-bold text-white">{t("directory")}</h2>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{t("tapToPlay")}</span>
              </div>
              <div className="max-h-[420px] overflow-y-auto divide-y divide-white/5">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                      <div className="h-9 w-9 rounded-lg" style={{ background: "var(--bg-hover)" }} />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-2/3 rounded" style={{ background: "var(--bg-hover)" }} />
                        <div className="h-2.5 w-1/2 rounded" style={{ background: "var(--bg-hover)" }} />
                      </div>
                    </div>
                  ))
                ) : (
                  filtered.slice(0, 12).map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setActiveChannel(ch)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
                      style={{
                        background: activeChannel?.id === ch.id ? "rgb(0 191 255 / 10%)" : "transparent",
                        borderLeft: activeChannel?.id === ch.id ? "3px solid var(--primary-accent)" : "3px solid transparent",
                      }}
                    >
                      {ch.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ch.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" style={{ border: "1px solid rgb(255 255 255 / 10%)" }} />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: "var(--bg-hover)" }}>
                          {ch.name.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium ${activeChannel?.id === ch.id ? "text-white" : ""}`} style={{ color: activeChannel?.id === ch.id ? "#fff" : "var(--text-main)" }}>
                          {ch.name}
                        </p>
                        <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                          {flagFromCountryName(ch.country)} {ch.country} · {ch.quality_tag.toUpperCase()}
                        </p>
                      </div>
                      {activeChannel?.id === ch.id && (
                        <span className="pulse-dot shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Install hint */}
            <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
              {t("installHint")}
            </p>
          </aside>
        </div>

        {/* ── Full channel grid ── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              {activeCategory ? `${sportEmoji(activeCategory)} ${activeCategory}` : "🌐 " + t("directory")}
            </h2>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {filtered.length} / {allChannels.length} channels
            </span>
          </div>

          {loading ? (
            <ChannelSkeletonGrid count={18} />
          ) : filtered.length === 0 ? (
            <div className="rounded-xl p-10 text-center" style={{ background: "var(--bg-card)", border: "1px solid rgb(0 191 255 / 20%)" }}>
              <p className="text-sm text-white">{t("noResults")}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{t("tryAdjust")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
              {filtered.map((ch, i) => (
                <PremiumChannelCard
                  key={ch.id}
                  channel={ch}
                  active={activeChannel?.id === ch.id}
                  onSelect={setActiveChannel}
                  index={i}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

/* ── Premium Channel Card ── */
function PremiumChannelCard({
  channel,
  active,
  onSelect,
  index,
}: {
  channel: Channel;
  active: boolean;
  onSelect: (c: Channel) => void;
  index: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(channel)}
      className={`ch-card group w-full p-3 text-left${active ? " active" : ""}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.01, 0.3), duration: 0.2 }}
    >
      <div className="flex items-start gap-3">
        {channel.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.logo_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
            style={{ border: "1px solid rgb(255 255 255 / 10%)" }}
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: active ? "var(--primary-accent)" : "var(--bg-hover)" }}
          >
            {channel.name.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{channel.name}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {flagFromCountryName(channel.country)} {channel.country}
          </p>
        </div>
        {active && <span className="pulse-dot mt-1 shrink-0" />}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: "rgb(255 255 255 / 6%)", color: "var(--text-muted)" }}
        >
          {sportEmoji(channel.category)} {channel.category}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
          style={{
            background: active ? "rgb(0 191 255 / 15%)" : "rgb(255 255 255 / 6%)",
            color: active ? "var(--primary-accent)" : "var(--text-muted)",
          }}
        >
          {channel.quality_tag}
        </span>
        {channel.quality_tag.toLowerCase().includes("hd") && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgb(0 200 81 / 15%)", color: "#00c851" }}>
            HD
          </span>
        )}
      </div>
    </motion.button>
  );
}
