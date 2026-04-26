"use client";

import dynamic from "next/dynamic";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Globe,
  RefreshCw,
  Search,
  Signal,
  Tv2,
  ChevronRight,
  Star,
  Link2,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AdSlot } from "@/components/ads/AdSlot";
import { AppShell } from "@/components/layout/AppShell";
import { ChannelSkeletonGrid } from "@/components/ui/ChannelSkeleton";
import { flagFromCountryName } from "@/components/channel/flagEmoji";
import { fetchAllChannels } from "@/lib/apiClient";
import { getChannelListCache, setChannelListCache } from "@/lib/channelListCache";
import { useI18n } from "@/lib/i18n/LocaleContext";
import type { Channel } from "@/lib/types";
import { usePlayerStore } from "@/store/playerStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import { useUiStore } from "@/store/uiStore";

const PremiumPlayer = dynamic(
  () => import("@/components/PremiumPlayer").then((m) => m.default),
  { ssr: false, loading: () => <div className="player-shell aspect-video animate-pulse" style={{ background: "var(--bg-card)" }} /> }
);

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

// League / sport groupings inferred from channel names
const LEAGUE_GROUPS: { label: string; keywords: string[] }[] = [
  { label: "⚽ Premier League",    keywords: ["premier league", "sky sports"] },
  { label: "⚽ La Liga",           keywords: ["laliga", "la liga", "teledeporte"] },
  { label: "⚽ Champions League",  keywords: ["champions league", "ucl"] },
  { label: "⚽ Serie A",           keywords: ["serie a", "sport italia", "sportitalia", "rai sport"] },
  { label: "⚽ Bundesliga",        keywords: ["bundesliga", "sportdigital"] },
  { label: "⚽ Ligue 1",          keywords: ["ligue 1", "l'equipe", "l1 max"] },
  { label: "⚽ Club TV",          keywords: ["barca", "realmadrid", "mutv", "canal do inter", "premiere fc"] },
  { label: "⚽ FIFA / Copa",      keywords: ["fifa", "copa"] },
  { label: "⚽ General Football", keywords: ["football", "futbol", "fussball", "soccer", "gol ", "goal"] },
  { label: "🏏 Cricket",          keywords: ["cricket", "willow", "ten sports", "ptv sports", "sony sports", "star sports", "t sports", "dd sports"] },
  { label: "🏀 NBA / Basketball", keywords: ["nba", "basketball"] },
  { label: "🎾 Tennis",           keywords: ["tennis", "tennis channel"] },
  { label: "🏎️ Formula 1 / Racing", keywords: ["formula 1", "f1 channel", "racer", "racing", "nhra"] },
  { label: "⛳ Golf",             keywords: ["golf", "pga", "lpga"] },
  { label: "🥊 Boxing / MMA",    keywords: ["boxing", "mma", "ufc", "fight", "combat", "bellator", "glory", "kickbox"] },
  { label: "🏒 Hockey / NHL",    keywords: ["hockey", "nhl", "khl"] },
  { label: "⚾ Baseball / MLB",   keywords: ["baseball", "mlb"] },
  { label: "🏈 NFL",              keywords: ["nfl"] },
  { label: "🚴 Cycling",         keywords: ["cycling"] },
  { label: "🏇 Horse Racing",    keywords: ["horse", "racing.com", "equidia", "atg", "teletrak", "turf"] },
  { label: "📺 News / General",  keywords: ["news", "rtv", "sangsad", "somoy", "channel 24", "jamuna", "boishakhi"] },
];

function inferLeague(name: string): string {
  const lower = name.toLowerCase();
  for (const g of LEAGUE_GROUPS) {
    if (g.keywords.some((kw) => lower.includes(kw))) return g.label;
  }
  return "🌐 Other Sports";
}

// Top-level sport-type filter: matches by DB category field OR inferred league
const SPORT_TYPES: { id: string; label: string; leagueEmoji: string; categoryKeys: string[] }[] = [
  { id: "football",   label: "⚽ Football",      leagueEmoji: "⚽", categoryKeys: ["football", "soccer", "futbol", "fussball", "calcio"] },
  { id: "cricket",    label: "🏏 Cricket",        leagueEmoji: "🏏", categoryKeys: ["cricket"] },
  { id: "basketball", label: "🏀 Basketball",    leagueEmoji: "🏀", categoryKeys: ["basketball", "nba"] },
  { id: "tennis",     label: "🎾 Tennis",         leagueEmoji: "🎾", categoryKeys: ["tennis"] },
  { id: "racing",     label: "🏎️ Racing / F1",    leagueEmoji: "🏎️", categoryKeys: ["racing", "formula", "f1"] },
  { id: "golf",       label: "⛳ Golf",           leagueEmoji: "⛳", categoryKeys: ["golf"] },
  { id: "boxing",     label: "🥊 Boxing / MMA",   leagueEmoji: "🥊", categoryKeys: ["boxing", "mma", "ufc", "fight"] },
  { id: "hockey",     label: "🏒 Hockey",         leagueEmoji: "🏒", categoryKeys: ["hockey"] },
  { id: "baseball",   label: "⚾ Baseball",       leagueEmoji: "⚾", categoryKeys: ["baseball"] },
  { id: "nfl",        label: "🏈 NFL",            leagueEmoji: "🏈", categoryKeys: ["nfl"] },
  { id: "cycling",    label: "🚴 Cycling",        leagueEmoji: "🚴", categoryKeys: ["cycling"] },
  { id: "horse",      label: "🏇 Horse Racing",   leagueEmoji: "🏇", categoryKeys: ["horse", "equid", "turf"] },
  { id: "rugby",      label: "🏉 Rugby",           leagueEmoji: "🏉", categoryKeys: ["rugby"] },
  { id: "volleyball", label: "🏐 Volleyball",      leagueEmoji: "🏐", categoryKeys: ["volleyball"] },
  { id: "athletics",  label: "🏃 Athletics",       leagueEmoji: "🏃", categoryKeys: ["athletics", "track"] },
  { id: "swimming",   label: "🏊 Swimming",        leagueEmoji: "🏊", categoryKeys: ["swimming", "aquatic"] },
  { id: "table-tennis", label: "🏓 Table Tennis",  leagueEmoji: "🏓", categoryKeys: ["table tennis", "tabletennis", "ping pong"] },
  { id: "badminton",  label: "🏸 Badminton",       leagueEmoji: "🏸", categoryKeys: ["badminton"] },
  { id: "snooker",    label: "🎱 Snooker",         leagueEmoji: "🎱", categoryKeys: ["snooker", "billiard", "pool"] },
  { id: "darts",      label: "🎯 Darts",           leagueEmoji: "🎯", categoryKeys: ["darts"] },
  { id: "wrestling",  label: "🤼 Wrestling",       leagueEmoji: "🤼", categoryKeys: ["wrestling", "wwe", "aew"] },
  { id: "news",       label: "📺 News / General",  leagueEmoji: "📺", categoryKeys: ["news", "general"] },
];

const BD_CATEGORIES: Record<string, string> = {
  news: "📰",
  entertainment: "🎭",
  drama: "🎬",
  sports: "🏆",
  music: "🎵",
  kids: "🧒",
  movies: "🎥",
  general: "📺",
  religious: "🕌",
  cooking: "🍽️",
};

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
  volleyball: "🏐",
  swimming: "🏊",
  tabletennis: "🏓",
  badminton: "🏸",
  snooker: "🎱",
  darts: "🎯",
  wrestling: "🤼",
};

function categoryEmoji(category: string, module: string): string {
  const key = category.toLowerCase();
  if (module === "bangladesh" || module === "india") {
    for (const [k, v] of Object.entries(BD_CATEGORIES)) {
      if (key.includes(k)) return v;
    }
    return "📺";
  }
  for (const [k, v] of Object.entries(SPORT_ICONS)) {
    if (key.includes(k)) return v;
  }
  return "📺";
}

type ActiveModule = "sports" | "india" | "bangladesh";

/* ── Chip filter component ── */
function FilterChips({
  label,
  options,
  value,
  onChange,
  maxVisible = 8,
  allLabel,
  showLessLabel,
  moreLabel,
  ariaLabel,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  maxVisible?: number;
  allLabel: string;
  showLessLabel: string;
  moreLabel: string;
  ariaLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : options.slice(0, maxVisible);
  return (
    <div role="group" aria-label={ariaLabel ?? label}>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={`filter-chip${value === "" ? " active" : ""}`}
          onClick={() => onChange("")}
        >
          {allLabel}
        </button>
        {visible.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`filter-chip${value === opt ? " active" : ""}`}
            onClick={() => onChange(value === opt ? "" : opt)}
          >
            {flagFromCountryName(opt)} {opt}
          </button>
        ))}
        {options.length > maxVisible && (
          <button
            type="button"
            className="filter-chip"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? showLessLabel : `+${options.length - maxVisible} ${moreLabel}`}
          </button>
        )}
      </div>
    </div>
  );
}

export function ViewerHome() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const activeModule = useUiStore((s) => s.activeModule);
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  const activeCategory = useUiStore((s) => s.activeCategory);
  const setActiveCategory = useUiStore((s) => s.setActiveCategory);
  const [filterCountry, setFilterCountry] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [filterLeague, setFilterLeague] = useState("");
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [activeStreamUrl, setActiveStreamUrl] = useState<string | null>(null);
  const [showAltLinks, setShowAltLinks] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const reduceM = useReducedMotion();
  const tier = useSubscriptionStore((s) => s.tier);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeChannel = usePlayerStore((state) => state.activeChannel);
  const isTheaterMode = usePlayerStore((state) => state.isTheaterMode);
  const setActiveChannel = usePlayerStore((state) => state.setActiveChannel);
  const toggleTheaterMode = usePlayerStore((state) => state.toggleTheaterMode);

  const loadChannels = useCallback(async (showToast = false, silent = false) => {
    const hasCache = (getChannelListCache()?.length ?? 0) > 0;
    if (!silent && (!hasCache || showToast)) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchAllChannels();
      setAllChannels(data);
      setChannelListCache(data);
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

  /** Free-tier UX: show last channel list from localStorage before network (stale-while-revalidate). */
  useLayoutEffect(() => {
    const c = getChannelListCache();
    if (c?.length) {
      setAllChannels(c);
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadChannels(false); }, [loadChannels]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem("gstv-welcome-hint") === "1") return;
    } catch {
      return;
    }
    setWelcomeOpen(true);
  }, []);

  useEffect(() => {
    const id = setInterval(() => void loadChannels(false, true), 5 * 60_000); // 5 min silent refresh
    return () => clearInterval(id);
  }, [loadChannels]);

  // Deep link: /?module=bangladesh|sports (e.g. manifest shortcuts, README)
  useEffect(() => {
    const m = searchParams.get("module")?.toLowerCase().trim();
    if (m === "bangladesh" || m === "sports" || m === "india") {
      setActiveModule(m);
    }
  }, [searchParams, setActiveModule]);

  // Reset local filters when module changes
  useEffect(() => {
    setFilterCountry("");
    setFilterLanguage("");
    setFilterLeague("");
    setActiveCategory("");
    setActiveStreamUrl(null);
    setShowAltLinks(false);
  }, [activeModule, setActiveCategory]);

  // Reset active stream URL when channel changes
  useEffect(() => {
    setActiveStreamUrl(null);
    setShowAltLinks(false);
  }, [activeChannel?.id]);

  // Auto-select first channel of active module; clear selection if this module has no rows (e.g. India not synced)
  useEffect(() => {
    const moduleChannels = allChannels.filter((c) => c.module === activeModule);
    if (moduleChannels.length === 0) {
      if (activeChannel && activeChannel.module !== activeModule) {
        setActiveChannel(null);
      }
      return;
    }
    if (!activeChannel || activeChannel.module !== activeModule) {
      setActiveChannel(moduleChannels[0]);
    }
  }, [allChannels, activeModule, activeChannel, setActiveChannel]);

  const moduleChannels = useMemo(
    () => allChannels.filter((c) => c.module === activeModule),
    [allChannels, activeModule]
  );

  const filtered = useMemo(() => {
    let list = moduleChannels;
    const q = deferredSearch.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));

    if (activeModule === "sports") {
      // Sport type: hero tabs and sidebar both set activeCategory (single source of truth)
      if (activeCategory) {
        const sport = SPORT_TYPES.find((s) => s.id === activeCategory);
        if (sport) {
          list = list.filter((c) => {
            const catLower = c.category.toLowerCase();
            const league = inferLeague(c.name);
            return sport.categoryKeys.some((k) => catLower.includes(k)) || league.startsWith(sport.leagueEmoji);
          });
        }
      }
      if (filterLeague && activeCategory) {
        list = list.filter((c) => inferLeague(c.name) === filterLeague);
      }
    } else {
      // India / Bangladesh: filter by DB category
      if (activeCategory) {
        const f = activeCategory.toLowerCase();
        list = list.filter((c) => c.category.toLowerCase().includes(f));
      }
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
  }, [moduleChannels, deferredSearch, activeCategory, filterCountry, filterLanguage, filterLeague, activeModule]);

  const categoryOptions = useMemo(() => uniqueSorted(moduleChannels.map((c) => c.category)), [moduleChannels]);
  const countryOptions = useMemo(() => uniqueSorted(moduleChannels.map((c) => c.country)), [moduleChannels]);
  const languageOptions = useMemo(() => uniqueSorted(moduleChannels.map((c) => c.language)), [moduleChannels]);
  // Count channels per sport type (only render chips that have channels)
  const sportChannelCount = useMemo<Record<string, number>>(() => {
    if (activeModule !== "sports") return {};
    const counts: Record<string, number> = {};
    for (const sport of SPORT_TYPES) {
      counts[sport.id] = moduleChannels.filter((c) => {
        const catLower = c.category.toLowerCase();
        const league = inferLeague(c.name);
        return sport.categoryKeys.some((k) => catLower.includes(k)) || league.startsWith(sport.leagueEmoji);
      }).length;
    }
    return counts;
  }, [moduleChannels, activeModule]);

  // Sub-leagues for the currently selected sport type (tab OR sidebar)
  const subLeagueOptions = useMemo(() => {
    if (activeModule !== "sports" || !activeCategory) return [];
    const sport = SPORT_TYPES.find((s) => s.id === activeCategory);
    if (!sport) return [];
    const sportChans = moduleChannels.filter((c) => {
      const catLower = c.category.toLowerCase();
      const league = inferLeague(c.name);
      return sport.categoryKeys.some((k) => catLower.includes(k)) || league.startsWith(sport.leagueEmoji);
    });
    return uniqueSorted([...new Set(sportChans.map((c) => inferLeague(c.name)))]);
  }, [activeCategory, moduleChannels, activeModule]);

  const nameMatchCount = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return 0;
    return moduleChannels.filter((c) => c.name.toLowerCase().includes(q)).length;
  }, [moduleChannels, deferredSearch]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        deferredSearch.trim() ||
          (activeModule === "sports" && activeCategory) ||
          ((activeModule === "bangladesh" || activeModule === "india") && activeCategory) ||
          filterLeague ||
          filterCountry ||
          filterLanguage
      ),
    [deferredSearch, activeModule, activeCategory, filterLeague, filterCountry, filterLanguage]
  );

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setActiveCategory("");
    setFilterLeague("");
    setFilterCountry("");
    setFilterLanguage("");
  }, [setActiveCategory]);

  const dismissWelcome = useCallback(() => {
    try {
      localStorage.setItem("gstv-welcome-hint", "1");
    } catch {
      /* */
    }
    setWelcomeOpen(false);
  }, []);

  const currentStreamUrl = activeStreamUrl ?? activeChannel?.stream_url ?? "";
  const altLinks = activeChannel?.alternate_urls ?? [];

  const bdCount = allChannels.filter((c) => c.module === "bangladesh").length;
  const inCount = allChannels.filter((c) => c.module === "india").length;
  const sportsCount = allChannels.filter((c) => c.module === "sports").length;

  return (
    <AppShell searchQuery={searchQuery} onSearch={setSearchQuery}>
      <div className="mx-auto w-full max-w-[1920px] space-y-4 sm:space-y-5 md:space-y-6">
        {welcomeOpen ? (
          <div
            role="region"
            aria-label={t("usageTips")}
            className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            style={{ background: "rgba(245,166,35,0.08)", borderColor: "rgba(245,166,35,0.25)" }}
          >
            <p className="text-left text-sm leading-relaxed" style={{ color: "var(--text-main)" }}>
              {t("welcomeHint")}
            </p>
            <button
              type="button"
              onClick={dismissWelcome}
              className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
              style={{ background: "var(--primary-accent)", color: "#0a0a0f" }}
            >
              {t("welcomeDismiss")}
            </button>
          </div>
        ) : null}

        {/* ── Module tabs (scroll on narrow screens) ── */}
        <div className="-mx-1 flex snap-x snap-mandatory items-center gap-2 overflow-x-auto overflow-y-hidden pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:overflow-visible">
          <button
            type="button"
            onClick={() => setActiveModule("sports")}
            className={`module-tab shrink-0 snap-start${activeModule === "sports" ? " active" : ""}`}
          >
            🌍 Sports TV
            {sportsCount > 0 && (
              <span className="module-tab-badge">{sportsCount}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveModule("india")}
            className={`module-tab shrink-0 snap-start${activeModule === "india" ? " active" : ""}`}
            style={activeModule === "india" ? { borderColor: "rgba(99,102,241,0.5)", color: "rgb(199 210 254)" } : undefined}
          >
            🇮🇳 India TV
            {inCount > 0 && <span className="module-tab-badge">{inCount}</span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveModule("bangladesh")}
            className={`module-tab shrink-0 snap-start${activeModule === "bangladesh" ? " active bd" : ""}`}
          >
            🇧🇩 Bangladesh TV
            {bdCount > 0 && (
              <span className="module-tab-badge">{bdCount}</span>
            )}
          </button>
        </div>

        {/* ── Hero header ── */}
        <motion.div
          initial={reduceM ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceM ? { duration: 0 } : { duration: 0.35 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: "rgba(245,166,35,0.15)" }}>
                <Tv2 className="h-4 w-4" style={{ color: "var(--primary-accent)" }} />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--primary-accent)" }}>
                {activeModule === "bangladesh"
                  ? "BANGLADESH TV"
                  : activeModule === "india"
                    ? "INDIA TV"
                    : "ABO SPORTS TV LIVE"}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl" style={{ color: "var(--text-main)" }}>
              {activeModule === "bangladesh"
                ? "বাংলাদেশ টিভি চ্যানেল"
                : activeModule === "india"
                  ? "भारत — सभी प्रकार के चैनल"
                  : t("tagline")}
            </h1>
            <div className="mt-1 space-y-1.5">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {loading
                  ? t("loading")
                  : error
                    ? error
                    : `${moduleChannels.length} ${t("channels")} · ${filtered.length} ${t("shown")}${
                        deferredSearch.trim() ? ` · ${nameMatchCount} ${t("searchMatches")}` : ""
                      }`}
              </p>
              {!loading && !error && hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <span style={{ color: "var(--primary-accent)" }}>{t("resultsSummary")}</span>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="rounded-md px-2 py-0.5 font-semibold transition hover:bg-white/5"
                    style={{ border: "1px solid rgba(245,166,35,0.35)", color: "var(--primary-accent)" }}
                  >
                    {t("clearFilters")}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Wide screens: second search (mobile uses TopBar #gstv-search only) */}
            <div className="relative hidden min-w-[200px] flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("search")}
                aria-label={t("search")}
                autoComplete="off"
                className="search-input w-full rounded-lg py-2 pl-9 pr-3 text-sm placeholder:text-slate-500"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (loading) {
                  toast.info(t("refreshWait"));
                  return;
                }
                void loadChannels(true);
              }}
              aria-busy={loading}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-opacity"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-main)", opacity: loading ? 0.75 : 1 }}
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden />
              {t("refresh")}
            </button>

            <div
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold"
              style={{ background: "rgba(229,57,53,0.1)", border: "1px solid rgba(229,57,53,0.3)", color: "#FF5252" }}
            >
              <Signal size={12} className="shrink-0" /> {t("hlsLive")}
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

        {/* ── Category / Sport-type tabs ── */}
        {activeModule === "sports" ? (
          /* Sports module: smart sport-type chips (auto-filtered, only non-empty) */
          <div className="space-y-1.5">
          <p className="px-0.5 text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>{t("sportFilterHint")}</p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              className={`cat-tab${activeCategory === "" ? " active" : ""}`}
              onClick={() => { setActiveCategory(""); setFilterLeague(""); }}
            >
              📺 {t("filterAll")}
            </button>
            {SPORT_TYPES.filter((s) => (sportChannelCount[s.id] ?? 0) > 0).map((sport) => (
              <button
                key={sport.id}
                type="button"
                className={`cat-tab${activeCategory === sport.id ? " active" : ""}`}
                onClick={() => {
                  setFilterLeague("");
                  setActiveCategory(activeCategory === sport.id ? "" : sport.id);
                }}
              >
                {sport.label}
                <span className="module-tab-badge">{sportChannelCount[sport.id]}</span>
              </button>
            ))}
          </div>
          </div>
        ) : (
          /* India / Bangladesh: category tabs from DB */
          <div className="space-y-1.5">
          <p className="px-0.5 text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>{t("sportFilterHint")}</p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              className={`cat-tab${activeCategory === "" ? " active" : ""}`}
              onClick={() => setActiveCategory("")}
            >
              📺 {t("filterAll")}
            </button>
            {categoryOptions.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`cat-tab${activeCategory === cat ? " active" : ""}`}
                onClick={() => setActiveCategory(activeCategory === cat ? "" : cat)}
              >
                {categoryEmoji(cat, activeModule)} {cat}
              </button>
            ))}
          </div>
          </div>
        )}

        {/* ── Sub-league chips (shown when a sport type is selected via tab OR sidebar) ── */}
        {activeModule === "sports" && activeCategory && subLeagueOptions.length > 1 && (
          <div
            className="rounded-xl px-4 py-3"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              🏆 League / Competition
            </p>
            <p className="mb-2 text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>{t("leagueFilterHint")}</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={`filter-chip${filterLeague === "" ? " active" : ""}`}
                onClick={() => setFilterLeague("")}
              >
                {t("filterAll")}
              </button>
              {subLeagueOptions.map((lg) => (
                <button
                  key={lg}
                  type="button"
                  className={`filter-chip${filterLeague === lg ? " active" : ""}`}
                  onClick={() => setFilterLeague(filterLeague === lg ? "" : lg)}
                >
                  {lg}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Filter chips ── */}
        <div>
          <div className="mb-0.5 flex items-center justify-between gap-2">
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
            {hasActiveFilters && (
              <span className="text-[10px] hidden sm:inline" style={{ color: "var(--text-muted)" }}>{t("moreFiltersHint")}</span>
            )}
          </div>
          <AnimatePresence>
            {showAllFilters && (
              <motion.div
                initial={reduceM ? false : { height: 0, opacity: 0 }}
                animate={reduceM ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                exit={reduceM ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={reduceM ? { duration: 0 } : { duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="mt-3 flex flex-col gap-3 rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <FilterChips
                    label={t("countryLabel")}
                    options={countryOptions}
                    value={filterCountry}
                    onChange={setFilterCountry}
                    allLabel={t("filterAll")}
                    showLessLabel={t("showLess")}
                    moreLabel={t("moreSuffix")}
                    ariaLabel={t("countryLabel")}
                  />
                  <FilterChips
                    label={t("languageLabel")}
                    options={languageOptions}
                    value={filterLanguage}
                    onChange={setFilterLanguage}
                    maxVisible={10}
                    allLabel={t("filterAll")}
                    showLessLabel={t("showLess")}
                    moreLabel={t("moreSuffix")}
                    ariaLabel={t("languageLabel")}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Main grid: player + channel list ── */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-6">

          {/* Player — tablet+ shares row with directory */}
          <section className="min-w-0 md:col-span-7 lg:col-span-8">
            {activeChannel ? (
              <PremiumPlayer
                streamUrl={currentStreamUrl}
                alternateUrls={altLinks}
                title={activeChannel.name}
                relayMeta={{
                  name: activeChannel.name,
                  category: activeChannel.category,
                  stream_url: activeChannel.stream_url,
                }}
                isTheaterMode={isTheaterMode}
                onToggleTheaterMode={toggleTheaterMode}
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
                initial={reduceM ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduceM ? { duration: 0 } : { duration: 0.2 }}
                className="mt-3 rounded-xl px-4 py-3"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  {activeChannel.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeChannel.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" style={{ border: "1px solid var(--border)" }} />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: "var(--primary-accent)" }}>
                      {activeChannel.name.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-widest" style={{ color: "var(--primary-accent)" }}>{t("nowPlaying")}</p>
                    <p className="truncate text-sm font-bold" style={{ color: "var(--text-main)" }}>{activeChannel.name}</p>
                    <p className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span>{flagFromCountryName(activeChannel.country)}</span>
                      <span>{activeChannel.country} · {activeChannel.category} · {activeChannel.quality_tag.toUpperCase()}</span>
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "rgba(245,166,35,0.12)", color: "var(--primary-accent)", border: "1px solid rgba(245,166,35,0.35)" }}>
                    <span className="pulse-dot" style={{ width: 6, height: 6 }} /> LIVE
                  </span>
                </div>

                {/* ── Alternate / Backup stream links ── */}
                {altLinks.length > 0 && (
                  <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                    <button
                      type="button"
                      onClick={() => setShowAltLinks((v) => !v)}
                      className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{ color: "var(--primary-accent)" }}
                    >
                      <Link2 size={13} />
                      {altLinks.length} Backup Stream{altLinks.length > 1 ? "s" : ""}
                      <ChevronRight size={12} className={`transition-transform ${showAltLinks ? "rotate-90" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {showAltLinks && (
                        <motion.div
                          initial={reduceM ? false : { height: 0, opacity: 0 }}
                          animate={reduceM ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                          exit={reduceM ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          transition={reduceM ? { duration: 0 } : { duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 flex flex-wrap gap-2">
                            {/* Primary link */}
                            <button
                              type="button"
                              onClick={() => setActiveStreamUrl(null)}
                              className={`alt-link-btn${!activeStreamUrl ? " active" : ""}`}
                            >
                              Primary
                            </button>
                            {altLinks.map((url, i) => (
                              <button
                                key={url}
                                type="button"
                                onClick={() => setActiveStreamUrl(url)}
                                className={`alt-link-btn${activeStreamUrl === url ? " active" : ""}`}
                              >
                                Backup {i + 1}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}
          </section>

          {/* Sidebar: upcoming channels */}
          <aside className="flex min-w-0 flex-col gap-3 md:col-span-5 lg:col-span-4">
            {tier === "free" && <AdSlot variant="inline" />}

            {/* Featured channels quick list */}
            <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{t("quickPicks")}</h2>
                  <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>{t("tapToPlay")}</span>
                </div>
                <p className="mt-0.5 text-[10px] leading-snug" style={{ color: "var(--text-muted)" }}>{t("quickPicksHint")}</p>
                {!loading && (
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    <span>
                      {t("showingFirst")} {Math.min(12, filtered.length)} {t("ofTotal")} {filtered.length}
                    </span>
                    {filtered.length > 12 && (
                      <button
                        type="button"
                        onClick={() => document.getElementById("channel-grid")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        className="font-semibold transition hover:underline"
                        style={{ color: "var(--primary-accent)" }}
                      >
                        {t("scrollToGrid")} ↓
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div
                className="max-h-[min(50dvh,26rem)] overflow-y-auto overscroll-y-contain divide-y sm:max-h-[min(55dvh,28rem)] md:max-h-[min(52dvh,26rem)] lg:max-h-[26.25rem]"
                style={{ borderColor: "var(--border)" }}
              >
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
                        background: activeChannel?.id === ch.id ? "rgba(245,166,35,0.08)" : "transparent",
                        borderLeft: activeChannel?.id === ch.id ? "3px solid var(--primary-accent)" : "3px solid transparent",
                      }}
                    >
                      {ch.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ch.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" style={{ border: "1px solid var(--border)" }} />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: "var(--bg-hover)" }}>
                          {ch.name.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-medium"
                          style={{ color: activeChannel?.id === ch.id ? "var(--primary-accent)" : "var(--text-main)" }}
                          title={ch.name}
                        >
                          {ch.name}
                        </p>
                        <p className="truncate text-xs" style={{ color: "var(--text-muted)" }} title={`${ch.country} · ${ch.language}`}>
                          {flagFromCountryName(ch.country)} {ch.country} · {ch.language} · {ch.quality_tag.toUpperCase()}
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
        <section id="channel-grid">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
              {activeModule === "sports" && activeCategory
                ? SPORT_TYPES.find((s) => s.id === activeCategory)?.label ?? "🌐 " + t("directory")
                : (activeModule === "bangladesh" || activeModule === "india") && activeCategory
                  ? `${categoryEmoji(activeCategory, activeModule)} ${activeCategory}`
                  : activeModule === "bangladesh"
                    ? "🇧🇩 Bangladesh TV Channels"
                    : activeModule === "india"
                      ? "🇮🇳 India TV Channels"
                      : "🌐 " + t("directory")}
            </h2>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {filtered.length} / {moduleChannels.length} channels
            </span>
          </div>

          {loading ? (
            <ChannelSkeletonGrid count={18} />
          ) : moduleChannels.length === 0 ? (
            <div className="rounded-xl p-10 text-center" style={{ background: "var(--bg-card)", border: "1px solid rgba(245,166,35,0.15)" }}>
              <p className="text-sm" style={{ color: "var(--text-main)" }}>{t("emptyModule")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl p-10 text-center" style={{ background: "var(--bg-card)", border: "1px solid rgba(245,166,35,0.15)" }}>
              <p className="text-sm" style={{ color: "var(--text-main)" }}>{t("noResults")}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{t("tryAdjust")}</p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
                  style={{ background: "var(--primary-accent)", color: "#0a0a0f" }}
                >
                  {t("noResultsCta")}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 xs:gap-3 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 lg:gap-4 xl:grid-cols-6 2xl:grid-cols-8">
              {filtered.map((ch, i) => (
                <PremiumChannelCard
                  key={ch.id}
                  channel={ch}
                  active={activeChannel?.id === ch.id}
                  onSelect={setActiveChannel}
                  index={i}
                  activeModule={activeModule}
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
  activeModule,
}: {
  channel: Channel;
  active: boolean;
  onSelect: (c: Channel) => void;
  index: number;
  activeModule: ActiveModule;
}) {
  const cardReduceM = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(channel)}
      className={`ch-card group w-full p-3 text-left${active ? " active" : ""}`}
      initial={cardReduceM ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={cardReduceM ? { duration: 0 } : { delay: Math.min(index * 0.01, 0.3), duration: 0.2 }}
    >
      <div className="flex items-start gap-3">
        {channel.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.logo_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
            style={{ border: "1px solid var(--border)" }}
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
          <p className="truncate text-sm font-semibold" style={{ color: "var(--text-main)" }} title={channel.name}>
            {channel.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs" style={{ color: "var(--text-muted)" }} title={`${channel.country} · ${channel.language}`}>
            {flagFromCountryName(channel.country)} {channel.country} · {channel.language}
          </p>
        </div>
        {active && <span className="pulse-dot mt-1 shrink-0" />}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: "rgb(255 255 255 / 6%)", color: "var(--text-muted)" }}
        >
          {categoryEmoji(channel.category, activeModule)} {channel.category}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
          style={{
            background: active ? "rgba(245,166,35,0.12)" : "rgb(255 255 255 / 6%)",
            color: active ? "var(--primary-accent)" : "var(--text-muted)",
          }}
        >
          {channel.quality_tag}
        </span>
        {channel.alternate_urls.length > 0 && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgb(30 110 232 / 15%)", color: "#60a5fa" }}>
            +{channel.alternate_urls.length} links
          </span>
        )}
      </div>
    </motion.button>
  );
}


