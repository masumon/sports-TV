"use client";

import dynamic from "next/dynamic";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Globe,
  RefreshCw,
  Signal,
  Tv2,
  ChevronRight,
  Star,
  Calendar,
} from "lucide-react";
import {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AdSlot } from "@/components/ads/AdSlot";
import { SplashScreen } from "@/components/SplashScreen";
import { AppShell } from "@/components/layout/AppShell";
import { ChannelSkeletonGrid } from "@/components/ui/ChannelSkeleton";
import { flagFromCountryName } from "@/components/channel/flagEmoji";
import { fetchAllChannels, apiClient } from "@/lib/apiClient";
import { getChannelListCache, setChannelListCache } from "@/lib/channelListCache";
import { fetchFanCodeLiveChannels } from "@/lib/fancodeLive";
import { useI18n } from "@/lib/i18n/LocaleContext";
import {
  loadFullCatalogWithLive,
  replaceLiveMatches,
} from "@/lib/streamCatalog";
import { orderedStreamUrlsForChannel } from "@/lib/channelStreams";
import { mergeDbChannelsIntoViewerCatalog } from "@/lib/viewerCatalogMerge";
import type { Channel, LiveFixture, ViewerModule } from "@/lib/types";
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

function isFootballOrCricketChannel(channel: Channel): boolean {
  const category = channel.category.toLowerCase();
  const name = channel.name.toLowerCase();
  const footballKeywords = [
    "football",
    "soccer",
    "futbol",
    "fussball",
    "laliga",
    "la liga",
    "premier league",
    "champions league",
    "serie a",
    "bundesliga",
    "ligue 1",
    "uefa",
    "fifa",
    "copa",
  ];
  const cricketKeywords = [
    "cricket",
    "ipl",
    "icc",
    "bpl",
    "psl",
    "t20",
    "odi",
    "test match",
  ];
  return [...footballKeywords, ...cricketKeywords].some((k) => category.includes(k) || name.includes(k));
}

/** Main grid: only this many cards mount at a time so 10k+ catalogs stay responsive (browser + PWA). */
const CHANNEL_GRID_BATCH = 96;

// Top-level sport-type filter: matches by DB category field OR inferred league
const SPORT_TYPES: { id: string; label: string; leagueEmoji: string; categoryKeys: string[] }[] = [
  { id: "football",   label: "⚽ Football",      leagueEmoji: "⚽", categoryKeys: ["football", "soccer", "futbol", "fussball", "calcio"] },
  { id: "cricket",    label: "🏏 Cricket",        leagueEmoji: "🏏", categoryKeys: ["cricket"] },
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
  if (module === "fast_tv") return "⚡";
  if (module === "live_matches") return "🔴";
  for (const [k, v] of Object.entries(SPORT_ICONS)) {
    if (key.includes(k)) return v;
  }
  return "📺";
}

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

/** Labels for API fixture status values */
function fixtureStatusLabel(status: string, tr: (k: string) => string): string {
  const s = status.toLowerCase();
  if (s === "live") return tr("fixtureStatusLive");
  if (s === "finished") return tr("fixtureStatusFinished");
  return tr("fixtureStatusScheduled");
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
  const reduceM = useReducedMotion();
  const tier = useSubscriptionStore((s) => s.tier);
  const gridSentinelRef = useRef<HTMLDivElement | null>(null);
  const [gridVisibleCount, setGridVisibleCount] = useState(CHANNEL_GRID_BATCH);
  const [scheduleFixtures, setScheduleFixtures] = useState<LiveFixture[]>([]);
  const [scheduleUpdated, setScheduleUpdated] = useState<string | null>(null);
  const [fixturesLoading, setFixturesLoading] = useState(false);
  const [scheduleView, setScheduleView] = useState<"live" | "upcoming" | "finished">("live");
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [splashReady, setSplashReady] = useState(false);
  // Tracks seconds since last fixtures refresh for the "last updated" indicator
  const [fixturesSince, setFixturesSince] = useState(0);
  const fixturesTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeChannel = usePlayerStore((state) => state.activeChannel);
  const isTheaterMode = usePlayerStore((state) => state.isTheaterMode);
  const setActiveChannel = usePlayerStore((state) => state.setActiveChannel);
  const toggleTheaterMode = usePlayerStore((state) => state.toggleTheaterMode);

  /** Defer large list + player work so click/tab stays responsive (INP / interaction-to-next-paint). */
  const selectChannel = useCallback(
    (ch: Channel) => {
      startTransition(() => {
        setActiveChannel(ch);
      });
    },
    [setActiveChannel]
  );
  const transitionSetActiveModule = useCallback(
    (m: ViewerModule) => {
      startTransition(() => {
        setActiveModule(m);
      });
    },
    [setActiveModule]
  );
  const transitionSetActiveCategory = useCallback(
    (c: string) => {
      startTransition(() => {
        setActiveCategory(c);
      });
    },
    [setActiveCategory]
  );

  /** Ceiling for full catalog (many M3Us + FanCode); clears spinner even if fetches never settle. */
  const CATALOG_LOAD_TIMEOUT_MS = 180_000;

  const loadChannels = useCallback(
    async (showToast = false, silent = false) => {
      const hasCache = (getChannelListCache()?.length ?? 0) > 0;
      if (!silent && (!hasCache || showToast)) {
        setLoading(true);
      }
      setError(null);
      try {
        const data = await new Promise<Channel[]>((resolve, reject) => {
          const id = setTimeout(() => reject(new Error(t("catalogTimeout"))), CATALOG_LOAD_TIMEOUT_MS);
          const merged = Promise.all([loadFullCatalogWithLive(), fetchAllChannels().catch(() => [])]).then(
            ([viewer, db]) => mergeDbChannelsIntoViewerCatalog(viewer, db)
          );
          void merged
            .then((d) => {
              clearTimeout(id);
              resolve(d);
            })
            .catch((err) => {
              clearTimeout(id);
              reject(err);
            });
        });
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
    },
    [t]
  );

  const refreshLiveMatchesOnly = useCallback(async () => {
    try {
      const live = await fetchFanCodeLiveChannels();
      setAllChannels((prev) => replaceLiveMatches(prev, live));
    } catch {
      /* silent background refresh */
    }
  }, []);

  const loadFixturesSchedule = useCallback(async () => {
    setFixturesLoading(true);
    try {
      const res = await apiClient.getLiveFixtures({ hours_back: 6, days_ahead: 14 });
      setScheduleFixtures(res.items);
      setScheduleUpdated(res.updated_hint ?? null);
    } catch {
      setScheduleFixtures([]);
    } finally {
      setFixturesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeModule !== "live_matches") return;
    void loadFixturesSchedule();
  }, [activeModule, loadFixturesSchedule]);

  // Poll every 90 seconds (was 20 min) so live scores/statuses feel real-time.
  useEffect(() => {
    if (activeModule !== "live_matches") return;
    const id = setInterval(() => void loadFixturesSchedule(), 90_000);
    return () => clearInterval(id);
  }, [activeModule, loadFixturesSchedule]);

  // Count seconds since last fixtures refresh (for "last updated X sec ago" badge)
  useEffect(() => {
    if (activeModule !== "live_matches") return;
    setFixturesSince(0);
    fixturesTimerRef.current && clearInterval(fixturesTimerRef.current);
    fixturesTimerRef.current = setInterval(() => setFixturesSince((s) => s + 1), 1000);
    return () => { fixturesTimerRef.current && clearInterval(fixturesTimerRef.current); };
  }, [activeModule, scheduleUpdated]);

  useEffect(() => {
    if (activeModule === "live_matches") {
      setScheduleView("live");
    }
  }, [activeModule]);

  const scheduleGroups = useMemo(() => {
    const now = Date.now();
    const live: LiveFixture[] = [];
    const upcoming: LiveFixture[] = [];
    const finished: LiveFixture[] = [];
    for (const fx of scheduleFixtures) {
      const s = (fx.status || "").toLowerCase();
      // Compute real-time status from starts_at_utc (avoids stale DB status between 3h syncs)
      const startMs = fx.starts_at_utc ? new Date(fx.starts_at_utc).getTime() : 0;
      const elapsed = startMs > 0 ? (now - startMs) / 60_000 : 0; // minutes since kick-off
      if (s === "finished" || elapsed > 130) finished.push(fx); // >130 min = likely done
      else if (startMs > 0 && startMs <= now) live.push(fx); // started but not finished
      else upcoming.push(fx);
    }
    // Sort live by most recently started
    live.sort((a, b) => new Date(a.starts_at_utc).getTime() - new Date(b.starts_at_utc).getTime());
    upcoming.sort((a, b) => new Date(a.starts_at_utc).getTime() - new Date(b.starts_at_utc).getTime());
    return { live, upcoming, finished };
  }, [scheduleFixtures]);

  const activeScheduleItems = useMemo(() => {
    if (scheduleView === "live") return scheduleGroups.live;
    if (scheduleView === "finished") return scheduleGroups.finished;
    return scheduleGroups.upcoming;
  }, [scheduleGroups, scheduleView]);

  /** Free-tier UX: show last channel list from localStorage before network (stale-while-revalidate). */
  useEffect(() => {
    const c = getChannelListCache();
    if (c?.length) {
      startTransition(() => {
        setAllChannels(c);
        setLoading(false);
      });
      // Cache hit → splash not needed, mark ready immediately
      setSplashReady(true);
    } else {
      // No cache → first visit: show branded splash until channels arrive
      setIsFirstVisit(true);
    }
  }, []);

  useEffect(() => {
    void loadChannels(false).finally(() => setSplashReady(true));
  }, [loadChannels]);

  useEffect(() => {
    const id = setInterval(() => void refreshLiveMatchesOnly(), 30 * 60_000);
    return () => clearInterval(id);
  }, [refreshLiveMatchesOnly]);

  // Deep link: /?module=…
  const qParam = searchParams.get("q")?.trim() ?? "";
  useEffect(() => {
    if (qParam) setSearchQuery(qParam);
  }, [qParam]);

  useEffect(() => {
    let m = searchParams.get("module")?.toLowerCase().trim();
    if (m === "sports") m = "global_sports";
    const allowed: ViewerModule[] = [
      "bangladesh",
      "global_sports",
      "india",
      "fast_tv",
      "live_matches",
    ];
    if (m && allowed.includes(m as ViewerModule)) {
      startTransition(() => {
        setActiveModule(m as ViewerModule);
      });
    }
  }, [searchParams, setActiveModule]);

  // Reset local filters when module changes (deferred: avoids blocking the tab click)
  useEffect(() => {
    startTransition(() => {
      setFilterCountry("");
      setFilterLanguage("");
      setFilterLeague("");
      setActiveCategory("");
    });
  }, [activeModule, setActiveCategory]);

  const moduleChannels = useMemo(
    () =>
      allChannels.filter((c) => {
        if (c.module !== activeModule) return false;
        if (activeModule !== "global_sports") return true;
        return isFootballOrCricketChannel(c);
      }),
    [allChannels, activeModule]
  );

  // Auto-select first channel of active module; clear selection if this module has no rows (e.g. India not synced)
  useEffect(() => {
    if (moduleChannels.length === 0) {
      if (activeChannel && activeChannel.module !== activeModule) {
        startTransition(() => {
          setActiveChannel(null);
        });
      }
      return;
    }
    if (!activeChannel || activeChannel.module !== activeModule) {
      startTransition(() => {
        setActiveChannel(moduleChannels[0]!);
      });
    }
  }, [moduleChannels, activeModule, activeChannel, setActiveChannel]);

  const filtered = useMemo(() => {
    let list = moduleChannels;
    const q = deferredSearch.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q));

    if (activeModule === "global_sports") {
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

  const gridFilterKey = useMemo(
    () =>
      [activeModule, deferredSearch, activeCategory, filterCountry, filterLanguage, filterLeague].join("\u0001"),
    [activeModule, deferredSearch, activeCategory, filterCountry, filterLanguage, filterLeague]
  );

  useEffect(() => {
    setGridVisibleCount(CHANNEL_GRID_BATCH);
  }, [gridFilterKey]);

  useEffect(() => {
    const el = gridSentinelRef.current;
    if (!el || loading || filtered.length === 0) return;
    if (gridVisibleCount >= filtered.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        startTransition(() => {
          setGridVisibleCount((c) => Math.min(c + CHANNEL_GRID_BATCH, filtered.length));
        });
      },
      { root: null, rootMargin: "480px 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading, filtered.length, gridVisibleCount]);

  const gridSlice = filtered.length <= gridVisibleCount ? filtered : filtered.slice(0, gridVisibleCount);
  const gridHasMore = !loading && filtered.length > gridSlice.length;

  const categoryOptions = useMemo(() => uniqueSorted(moduleChannels.map((c) => c.category)), [moduleChannels]);
  const countryOptions = useMemo(() => uniqueSorted(moduleChannels.map((c) => c.country)), [moduleChannels]);
  const languageOptions = useMemo(() => uniqueSorted(moduleChannels.map((c) => c.language)), [moduleChannels]);
  // Count channels per sport type (only render chips that have channels)
  const sportChannelCount = useMemo<Record<string, number>>(() => {
    if (activeModule !== "global_sports") return {};
    const counts: Record<string, number> = Object.fromEntries(SPORT_TYPES.map((s) => [s.id, 0])) as Record<
      string,
      number
    >;
    for (const c of moduleChannels) {
      const catLower = c.category.toLowerCase();
      const league = inferLeague(c.name);
      for (const sport of SPORT_TYPES) {
        if (sport.categoryKeys.some((k) => catLower.includes(k)) || league.startsWith(sport.leagueEmoji)) {
          counts[sport.id] = (counts[sport.id] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [moduleChannels, activeModule]);

  // Sub-leagues for the currently selected sport type (tab OR sidebar)
  const subLeagueOptions = useMemo(() => {
    if (activeModule !== "global_sports" || !activeCategory) return [];
    const sport = SPORT_TYPES.find((s) => s.id === activeCategory);
    if (!sport) return [];
    const leagues = new Set<string>();
    for (const c of moduleChannels) {
      const catLower = c.category.toLowerCase();
      const league = inferLeague(c.name);
      const inSport =
        sport.categoryKeys.some((k) => catLower.includes(k)) || league.startsWith(sport.leagueEmoji);
      if (inSport) leagues.add(league);
    }
    return uniqueSorted([...leagues]);
  }, [activeCategory, moduleChannels, activeModule]);

  const nameMatchCount = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return 0;
    let n = 0;
    for (const c of moduleChannels) {
      if (c.name.toLowerCase().includes(q)) n += 1;
    }
    return n;
  }, [moduleChannels, deferredSearch]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        deferredSearch.trim() ||
          (activeModule === "global_sports" && activeCategory) ||
          ((activeModule === "bangladesh" || activeModule === "india" || activeModule === "fast_tv" || activeModule === "live_matches") &&
            activeCategory) ||
          filterLeague ||
          filterCountry ||
          filterLanguage
      ),
    [deferredSearch, activeModule, activeCategory, filterLeague, filterCountry, filterLanguage]
  );

  const clearAllFilters = useCallback(() => {
    startTransition(() => {
      setSearchQuery("");
      setActiveCategory("");
      setFilterLeague("");
      setFilterCountry("");
      setFilterLanguage("");
    });
  }, [setActiveCategory]);

  const setFilterCountryT = useCallback((v: string) => {
    startTransition(() => {
      setFilterCountry(v);
    });
  }, []);
  const setFilterLanguageT = useCallback((v: string) => {
    startTransition(() => {
      setFilterLanguage(v);
    });
  }, []);
  const setFilterLeagueT = useCallback((v: string) => {
    startTransition(() => {
      setFilterLeague(v);
    });
  }, []);

  const playbackUrls = useMemo(() => {
    if (!activeChannel) return [];
    return orderedStreamUrlsForChannel(activeChannel);
  }, [activeChannel]);

  const { gsCount, inCount, bdCount, fastCount, liveCount } = useMemo(() => {
    let gs = 0;
    let i = 0;
    let b = 0;
    let f = 0;
    let l = 0;
    for (const c of allChannels) {
      if (c.module === "global_sports") gs += 1;
      else if (c.module === "india") i += 1;
      else if (c.module === "bangladesh") b += 1;
      else if (c.module === "fast_tv") f += 1;
      else if (c.module === "live_matches") l += 1;
    }
    return { gsCount: gs, inCount: i, bdCount: b, fastCount: f, liveCount: l };
  }, [allChannels]);

  return (
    <>
      {/* Branded splash screen — shown only on first visit (no cache), fades out once channels load */}
      {isFirstVisit && <SplashScreen ready={splashReady} />}
    <AppShell searchQuery={searchQuery} onSearch={setSearchQuery}>
      <div className="mx-auto w-full max-w-[1920px] space-y-4 sm:space-y-5 md:space-y-6">

        {/* ── Module tabs: hidden on mobile (bottom nav handles navigation there) ── */}
        <div className="hidden md:flex snap-x snap-mandatory items-center gap-2 overflow-x-auto overflow-y-hidden pb-1 scrollbar-none sm:flex-wrap sm:overflow-visible">
          <button
            type="button"
            onClick={() => {
              transitionSetActiveModule("global_sports");
            }}
            className={`module-tab shrink-0 snap-start${activeModule === "global_sports" ? " active" : ""}`}
          >
            🌍 Global Sports
            {gsCount > 0 && <span className="module-tab-badge">{gsCount}</span>}
          </button>
          <button
            type="button"
            onClick={() => {
              transitionSetActiveModule("bangladesh");
            }}
            className={`module-tab shrink-0 snap-start${activeModule === "bangladesh" ? " active bd" : ""}`}
          >
            🇧🇩 Bangladesh
            {bdCount > 0 && <span className="module-tab-badge">{bdCount}</span>}
          </button>
          <button
            type="button"
            onClick={() => {
              transitionSetActiveModule("india");
            }}
            className={`module-tab module-tab--in shrink-0 snap-start${activeModule === "india" ? " active" : ""}`}
          >
            🇮🇳 India
            {inCount > 0 && <span className="module-tab-badge">{inCount}</span>}
          </button>
          <button
            type="button"
            onClick={() => {
              transitionSetActiveModule("fast_tv");
            }}
            className={`module-tab shrink-0 snap-start${activeModule === "fast_tv" ? " active" : ""}`}
          >
            ⚡ FAST TV
            {fastCount > 0 && <span className="module-tab-badge">{fastCount}</span>}
          </button>
          <button
            type="button"
            onClick={() => {
              transitionSetActiveModule("live_matches");
            }}
            className={`module-tab shrink-0 snap-start${activeModule === "live_matches" ? " active" : ""}`}
          >
            🔴 Live Matches
            {liveCount > 0 && <span className="module-tab-badge">{liveCount}</span>}
          </button>
        </div>

        {activeModule === "live_matches" ? (
          scheduleFixtures.length > 0 || fixturesLoading ? (
            <section
              className="rounded-xl overflow-hidden"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {scheduleGroups.live.length > 0 && (
                    <span className="pulse-dot shrink-0" aria-label="live" />
                  )}
                  <Calendar className="h-4 w-4 shrink-0" style={{ color: "var(--primary-accent)" }} />
                  <h2 className="text-sm font-bold truncate" style={{ color: "var(--text-main)" }}>
                    {t("matchScheduleHeading")}
                    {scheduleGroups.live.length > 0 && (
                      <span className="ml-2 text-[11px] font-normal" style={{ color: "#f87171" }}>
                        · {scheduleGroups.live.length} LIVE
                      </span>
                    )}
                  </h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Last updated counter */}
                  {scheduleUpdated && (
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {fixturesSince < 60
                        ? `${fixturesSince}s ago`
                        : `${Math.floor(fixturesSince / 60)}m ago`}
                    </span>
                  )}
                  {/* Manual refresh */}
                  <button
                    type="button"
                    onClick={() => { setFixturesSince(0); void loadFixturesSchedule(); }}
                    disabled={fixturesLoading}
                    title="রিফ্রেশ করুন"
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-80"
                    style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)", color: "var(--primary-accent)" }}
                  >
                    <RefreshCw size={11} className={fixturesLoading ? "animate-spin" : ""} />
                    {fixturesLoading ? "…" : "↻"}
                  </button>
                </div>
              </div>
              <p className="px-4 py-2 text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>
                {t("matchScheduleHint")}
              </p>
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleView("live")}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
                    style={{
                      background: scheduleView === "live" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
                      border: scheduleView === "live" ? "1px solid rgba(239,68,68,0.35)" : "1px solid var(--border)",
                      color: scheduleView === "live" ? "#f87171" : "var(--text-muted)",
                    }}
                  >
                    {t("fixtureStatusLive")} ({scheduleGroups.live.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleView("upcoming")}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
                    style={{
                      background: scheduleView === "upcoming" ? "rgba(245,166,35,0.12)" : "rgba(255,255,255,0.04)",
                      border: scheduleView === "upcoming" ? "1px solid rgba(245,166,35,0.35)" : "1px solid var(--border)",
                      color: scheduleView === "upcoming" ? "var(--primary-accent)" : "var(--text-muted)",
                    }}
                  >
                    {t("fixtureStatusScheduled")} ({scheduleGroups.upcoming.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleView("finished")}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
                    style={{
                      background: scheduleView === "finished" ? "rgba(120,120,120,0.15)" : "rgba(255,255,255,0.04)",
                      border: scheduleView === "finished" ? "1px solid rgba(120,120,120,0.35)" : "1px solid var(--border)",
                      color: scheduleView === "finished" ? "var(--text-main)" : "var(--text-muted)",
                    }}
                  >
                    {t("fixtureStatusFinished")} ({scheduleGroups.finished.length})
                  </button>
                </div>
              </div>
              <div className="max-h-[min(50vh,28rem)] overflow-y-auto overscroll-y-contain divide-y" style={{ borderColor: "var(--border)" }}>
                {fixturesLoading && activeScheduleItems.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs" style={{ color: "var(--text-muted)" }}>
                    <RefreshCw size={14} className="animate-spin" />
                    লাইভ ম্যাচ লোড হচ্ছে…
                  </div>
                ) : activeScheduleItems.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                    {t("scheduleEmptyByStatus")}
                  </div>
                ) : null}
                {activeScheduleItems.slice(0, 48).map((fx) => {
                  const startMs = fx.starts_at_utc ? new Date(fx.starts_at_utc).getTime() : 0;
                  const nowMs = Date.now();
                  const elapsedMin = startMs > 0 ? Math.floor((nowMs - startMs) / 60_000) : 0;
                  const isReallyLive = startMs > 0 && startMs <= nowMs && (fx.status || "").toLowerCase() !== "finished" && elapsedMin <= 130;
                  const isFinished = (fx.status || "").toLowerCase() === "finished" || elapsedMin > 130;
                  return (
                    <div key={fx.id} className="px-4 py-3 transition-colors hover:bg-white/[0.02]">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {/* League name + sport icon */}
                          <div className="flex items-center gap-1.5">
                            <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text-muted)" }}>
                              {fx.sport ? `${fx.sport === "Soccer" ? "⚽" : fx.sport === "Cricket" ? "🏏" : "🏆"} ` : "🏆 "}{fx.league_name}
                            </p>
                          </div>
                          {/* Teams */}
                          <div className="mt-1.5 flex items-center gap-2">
                            {fx.thumb_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={fx.thumb_url}
                                alt=""
                                className="h-7 w-7 shrink-0 rounded-md object-cover"
                                style={{ border: "1px solid var(--border)" }}
                              />
                            ) : (
                              <div
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
                                style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}
                              >
                                VS
                              </div>
                            )}
                            <p className="min-w-0 truncate text-sm font-bold" style={{ color: "var(--text-main)" }}>
                              {fx.home_team} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>vs</span> {fx.away_team}
                            </p>
                          </div>
                          {/* Time info */}
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            {isReallyLive ? (
                              <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#f87171" }}>
                                <span className="pulse-dot" style={{ width: 6, height: 6 }} aria-hidden />
                                {elapsedMin}&apos; চলছে
                              </span>
                            ) : (
                              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                                {new Date(fx.starts_at_utc).toLocaleString(undefined, {
                                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                                })}
                              </p>
                            )}
                            {fx.data_attribution ? (
                              <p className="text-[10px] leading-snug" style={{ color: "var(--text-muted)" }}>
                                · {fx.data_attribution}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        {/* Status badge */}
                        <span
                          className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                          style={{
                            background: isReallyLive
                              ? "rgba(239,68,68,0.15)"
                              : isFinished
                                ? "rgba(120,120,120,0.15)"
                                : "rgba(245,166,35,0.12)",
                            color: isReallyLive
                              ? "#f87171"
                              : isFinished
                                ? "var(--text-muted)"
                                : "var(--primary-accent)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {isReallyLive ? "🔴 LIVE" : isFinished ? "✓ শেষ" : "⏰ আসছে"}
                        </span>
                      </div>
                      {/* Suggested channels */}
                      {fx.suggested_channels?.length ? (
                        <div className="mt-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
                            📺 {t("suggestedStreamsLabel")}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {fx.suggested_channels.slice(0, 6).map((ch) => (
                              <button
                                key={`${fx.id}-${ch.id}`}
                                type="button"
                                onClick={() => selectChannel(ch)}
                                className="flex items-center gap-1 max-w-[12rem] truncate rounded-md px-2 py-1 text-[11px] font-medium transition hover:opacity-90 active:scale-95"
                                style={{
                                  background: isReallyLive ? "rgba(239,68,68,0.1)" : "rgba(245,166,35,0.1)",
                                  border: isReallyLive ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(245,166,35,0.25)",
                                  color: isReallyLive ? "#f87171" : "var(--primary-accent)",
                                }}
                                title={ch.name}
                              >
                                ▶ {ch.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : !loading && !fixturesLoading ? (
            <p className="text-center text-xs px-2" style={{ color: "var(--text-muted)" }}>
              {t("scheduleEmpty")}
            </p>
          ) : null
        ) : null}

        {/* ── Hero header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Tv2 className="h-4 w-4 shrink-0" style={{ color: "var(--primary-accent)" }} />
              <span className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--primary-accent)" }}>
                {activeModule === "bangladesh"
                  ? "BANGLADESH"
                  : activeModule === "india"
                    ? "INDIA"
                    : activeModule === "fast_tv"
                      ? "FAST TV 24/7"
                      : activeModule === "live_matches"
                        ? "LIVE MATCHES"
                        : "GLOBAL SPORTS"}
              </span>
            </div>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight md:text-2xl" style={{ color: "var(--text-main)" }}>
              {activeModule === "bangladesh"
                ? "🇧🇩 বাংলাদেশ টিভি চ্যানেল"
                : activeModule === "india"
                  ? "🇮🇳 India Channels"
                  : activeModule === "fast_tv"
                    ? "⚡ FAST TV 24/7"
                    : activeModule === "live_matches"
                      ? "🔴 Live Match Schedule"
                      : t("tagline")}
            </h1>
            <div className="mt-1 space-y-1">
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
            {/* Refresh button */}
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
              <span className="hidden sm:inline">{t("refresh")}</span>
            </button>

            <div
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold"
              style={{ background: "rgba(229,57,53,0.1)", border: "1px solid rgba(229,57,53,0.3)", color: "#FF5252" }}
            >
              <Signal size={12} className="shrink-0" /> HLS
            </div>

            {tier === "premium" && (
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: "rgb(251 191 36 / 15%)", border: "1px solid rgb(251 191 36 / 30%)", color: "#fbbf24" }}>
                <Star size={12} fill="currentColor" /> {t("premium")}
              </div>
            )}
          </div>
        </div>

        {/* ── AdSlot banner ── */}
        {tier === "free" && <AdSlot variant="banner" />}

        {/* ── Category / Sport-type tabs ── */}
        {activeModule === "global_sports" ? (
          /* Sports module: smart sport-type chips (auto-filtered, only non-empty) */
          <div className="space-y-1.5">
          <p className="px-0.5 text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>{t("sportFilterHint")}</p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              className={`cat-tab${activeCategory === "" ? " active" : ""}`}
              onClick={() => {
                startTransition(() => {
                  setFilterLeague("");
                  setActiveCategory("");
                });
              }}
            >
              📺 {t("filterAll")}
            </button>
            {SPORT_TYPES.filter((s) => (sportChannelCount[s.id] ?? 0) > 0).map((sport) => (
              <button
                key={sport.id}
                type="button"
                className={`cat-tab${activeCategory === sport.id ? " active" : ""}`}
                onClick={() => {
                  startTransition(() => {
                    setFilterLeague("");
                    setActiveCategory(activeCategory === sport.id ? "" : sport.id);
                  });
                }}
              >
                {sport.label}
                <span className="module-tab-badge">{sportChannelCount[sport.id]}</span>
              </button>
            ))}
          </div>
          </div>
        ) : (
          /* Regional / FAST / Live: category tabs from parsed group-title */
          <div className="space-y-1.5">
          <p className="px-0.5 text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>{t("sportFilterHint")}</p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              className={`cat-tab${activeCategory === "" ? " active" : ""}`}
              onClick={() => {
                transitionSetActiveCategory("");
              }}
            >
              📺 {t("filterAll")}
            </button>
            {categoryOptions.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`cat-tab${activeCategory === cat ? " active" : ""}`}
                onClick={() => {
                  transitionSetActiveCategory(activeCategory === cat ? "" : cat);
                }}
              >
                {categoryEmoji(cat, activeModule)} {cat}
              </button>
            ))}
          </div>
          </div>
        )}

        {/* ── Sub-league chips (shown when a sport type is selected via tab OR sidebar) ── */}
        {activeModule === "global_sports" && activeCategory && subLeagueOptions.length > 1 && (
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
                onClick={() => {
                  setFilterLeagueT("");
                }}
              >
                {t("filterAll")}
              </button>
              {subLeagueOptions.map((lg) => (
                <button
                  key={lg}
                  type="button"
                  className={`filter-chip${filterLeague === lg ? " active" : ""}`}
                  onClick={() => {
                    setFilterLeagueT(filterLeague === lg ? "" : lg);
                  }}
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
              onClick={() => {
                startTransition(() => {
                  setShowAllFilters((v) => !v);
                });
              }}
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
                    onChange={setFilterCountryT}
                    allLabel={t("filterAll")}
                    showLessLabel={t("showLess")}
                    moreLabel={t("moreSuffix")}
                    ariaLabel={t("countryLabel")}
                  />
                  <FilterChips
                    label={t("languageLabel")}
                    options={languageOptions}
                    value={filterLanguage}
                    onChange={setFilterLanguageT}
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
                streamUrl={playbackUrls[0] ?? activeChannel.stream_url}
                streamUrls={playbackUrls.length > 0 ? playbackUrls : undefined}
                alternateUrls={[]}
                title={activeChannel.name}
                isTheaterMode={isTheaterMode}
                onToggleTheaterMode={toggleTheaterMode}
                headerProfile={activeChannel.header_profile ?? null}
                geoHint={Boolean(activeChannel.geo_hint)}
                channelLogoUrl={activeChannel.logo_url}
              />
            ) : (
              <div className="player-shell flex aspect-video items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
                {t("noChannel")}
              </div>
            )}

            {/* Now playing info strip */}
            {activeChannel && (
              <div
                key={activeChannel.id}
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
              </div>
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
                      onClick={() => {
                        selectChannel(ch);
                      }}
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
              {activeModule === "global_sports" && activeCategory
                ? SPORT_TYPES.find((s) => s.id === activeCategory)?.label ?? "🌐 " + t("directory")
                : (activeModule === "bangladesh" ||
                    activeModule === "india" ||
                    activeModule === "fast_tv" ||
                    activeModule === "live_matches") &&
                    activeCategory
                  ? `${categoryEmoji(activeCategory, activeModule)} ${activeCategory}`
                  : activeModule === "bangladesh"
                    ? "🇧🇩 Bangladesh TV Channels"
                    : activeModule === "india"
                      ? "🇮🇳 India TV Channels"
                      : activeModule === "fast_tv"
                        ? "⚡ FAST TV (24/7)"
                        : activeModule === "live_matches"
                          ? "🔴 FanCode Live Matches"
                          : "🌐 " + t("directory")}
            </h2>
            <span className="text-xs text-right" style={{ color: "var(--text-muted)" }}>
              <span className="block sm:inline">
                {t("showingFirst")} {gridSlice.length} {t("ofTotal")} {filtered.length}
                {filtered.length !== moduleChannels.length ? ` · ${moduleChannels.length} ${t("channels")}` : ""}
              </span>
              {gridHasMore ? (
                <span className="mt-0.5 block text-[10px] sm:mt-0 sm:ml-1 sm:inline">{t("gridScrollHint")}</span>
              ) : null}
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
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 xs:gap-3 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 lg:gap-4 xl:grid-cols-6 2xl:grid-cols-8">
                {gridSlice.map((ch) => (
                  <PremiumChannelCard
                    key={ch.id}
                    channel={ch}
                    active={activeChannel?.id === ch.id}
                    onSelect={selectChannel}
                    activeModule={activeModule}
                  />
                ))}
              </div>
              {gridHasMore ? (
                <>
                  <div ref={gridSentinelRef} className="h-1 w-full" aria-hidden />
                  <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        startTransition(() => {
                          setGridVisibleCount((c) => Math.min(c + CHANNEL_GRID_BATCH, filtered.length));
                        });
                      }}
                      className="rounded-lg px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
                      style={{ background: "var(--primary-accent)", color: "#0a0a0f" }}
                    >
                      {t("gridLoadMore")} (+{Math.min(CHANNEL_GRID_BATCH, filtered.length - gridSlice.length)})
                    </button>
                  </div>
                </>
              ) : filtered.length > CHANNEL_GRID_BATCH ? (
                <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
                  {t("gridEnd")}
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </AppShell>
    </>
  );
}

/* ── Premium Channel Card (plain button: avoids N× framer + stagger on large grids → better INP) ── */
const PremiumChannelCard = memo(function PremiumChannelCard({
  channel,
  active,
  onSelect,
  activeModule,
}: {
  channel: Channel;
  active: boolean;
  onSelect: (c: Channel) => void;
  activeModule: ViewerModule;
}) {
  return (
    <div
      className={`ch-card group w-full p-3${active ? " active" : ""}`}
    >
      <button
        type="button"
        onClick={() => {
          onSelect(channel);
        }}
        className="w-full text-left"
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
        </div>
      </button>
    </div>
  );
});


