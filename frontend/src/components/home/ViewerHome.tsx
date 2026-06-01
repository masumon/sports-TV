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
  X,
  Share2,
  Clock,
  AlertTriangle,
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
import { AppShell } from "@/components/layout/AppShell";
import { ChannelSkeletonGrid } from "@/components/ui/ChannelSkeleton";
import { WorldCupSchedule } from "@/components/home/WorldCupSchedule";
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
import { useSwipeGesture } from "@/lib/useSwipeGesture";
import type { Channel, LiveFixture, ViewerModule } from "@/lib/types";
import { usePlayerStore } from "@/store/playerStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import { useUiStore } from "@/store/uiStore";

const PremiumPlayer = dynamic(
  () => import("@/components/PremiumPlayer").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="player-shell aspect-video flex flex-col items-center justify-center gap-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[var(--primary-accent)]" />
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Loading stream…</p>
      </div>
    ),
  }
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

const FIXTURE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
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


const MODULE_ORDER: ViewerModule[] = ["bangladesh", "live_matches", "world_cup_2026", "global_sports", "india", "fast_tv"];

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
  const [fixtureSportFilter, setFixtureSportFilter] = useState<"all" | "Soccer" | "Cricket">("all");
  const [fixturesSince, setFixturesSince] = useState(0);
  const fixturesTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [coldStart, setColdStart] = useState(false);
  const [coldStartDismissed, setColdStartDismissed] = useState(false);
  const coldStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [coldStartSeconds, setColdStartSeconds] = useState(0);
  const coldStartCounterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deepLinkAppliedRef = useRef<string | null>(null);
  const [recentlyWatched, setRecentlyWatched] = useState<number[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const setModuleCounts = useUiStore((s) => s.setModuleCounts);
  const setSearchSuggestions = useUiStore((s) => s.setSearchSuggestions);

  const activeChannel = usePlayerStore((state) => state.activeChannel);
  const isTheaterMode = usePlayerStore((state) => state.isTheaterMode);
  const setActiveChannel = usePlayerStore((state) => state.setActiveChannel);
  const toggleTheaterMode = usePlayerStore((state) => state.toggleTheaterMode);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("gstv-recently-watched");
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) setRecentlyWatched(parsed.filter((x): x is number => typeof x === "number"));
      }
    } catch { /* ignore */ }
    try {
      const storedFav = localStorage.getItem("gstv-favorites");
      if (storedFav) {
        const parsed: unknown = JSON.parse(storedFav);
        if (Array.isArray(parsed)) setFavorites(parsed.filter((x): x is number => typeof x === "number"));
      }
    } catch { /* ignore */ }
  }, []);

  /** Defer large list + player work so click/tab stays responsive (INP / interaction-to-next-paint). */
  const selectChannel = useCallback(
    (ch: Channel) => {
      startTransition(() => {
        setActiveChannel(ch);
      });
      setRecentlyWatched((prev) => {
        const next = [ch.id, ...prev.filter((id) => id !== ch.id)].slice(0, 10);
        try { localStorage.setItem("gstv-recently-watched", JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    },
    [setActiveChannel]
  );
  const toggleFavorite = useCallback((ch: Channel) => {
    setFavorites((prev) => {
      const isAdding = !prev.includes(ch.id);
      const next = isAdding
        ? [ch.id, ...prev].slice(0, 30)
        : prev.filter((id) => id !== ch.id);
      try { localStorage.setItem("gstv-favorites", JSON.stringify(next)); } catch { /* ignore */ }
      toast(isAdding ? `⭐ ${ch.name} favorites-এ যোগ হয়েছে` : `${ch.name} favorites থেকে সরানো হয়েছে`, { duration: 2000 });
      return next;
    });
  }, []);

  const shareChannel = useCallback((ch: Channel) => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/?channel=${encodeURIComponent(ch.name)}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: ch.name, text: `Watch ${ch.name} live`, url }).catch(() => null);
    } else {
      navigator.clipboard?.writeText(url).then(() => toast(`🔗 লিংক কপি হয়েছে: ${ch.name}`, { duration: 2500 })).catch(() => null);
    }
  }, []);

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

  /** Ceiling for full catalog; clears spinner even if fetches never settle. */
  const CATALOG_LOAD_TIMEOUT_MS = 30_000;

  const loadChannels = useCallback(
    async (showToast = false, silent = false) => {
      const hasCache = (getChannelListCache()?.length ?? 0) > 0;
      if (!silent && (!hasCache || showToast)) {
        setLoading(true);
      }
      setError(null);
      // Cold-start detection: if backend takes > 3s, show wakeup banner
      if (!silent) {
        setColdStartDismissed(false);
        setColdStart(false);
        setColdStartSeconds(0);
        if (coldStartTimerRef.current) {
          clearTimeout(coldStartTimerRef.current);
          coldStartTimerRef.current = null;
        }
        if (coldStartCounterRef.current) {
          clearInterval(coldStartCounterRef.current);
          coldStartCounterRef.current = null;
        }
        coldStartTimerRef.current = setTimeout(() => {
          setColdStart(true);
          setColdStartSeconds(0);
          if (coldStartCounterRef.current) clearInterval(coldStartCounterRef.current);
          coldStartCounterRef.current = setInterval(() => {
            setColdStartSeconds((s) => s + 1);
          }, 1000);
        }, 3000);
      }
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
        if (!silent) {
          setLoading(false);
          setColdStart(false);
          setColdStartSeconds(0);
          if (coldStartTimerRef.current) clearTimeout(coldStartTimerRef.current);
          if (coldStartCounterRef.current) {
            clearInterval(coldStartCounterRef.current);
            coldStartCounterRef.current = null;
          }
        }
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
    if (activeModule !== "live_matches" && activeModule !== "world_cup_2026") return;
    void loadFixturesSchedule();
  }, [activeModule, loadFixturesSchedule]);

  // Poll every 90 seconds so live scores/statuses feel real-time.
  // Skip fetch when the tab is hidden — saves battery and bandwidth on mobile.
  useEffect(() => {
    if (activeModule !== "live_matches" && activeModule !== "world_cup_2026") return;
    const id = setInterval(() => {
      if (!document.hidden) void loadFixturesSchedule();
    }, 90_000);
    return () => clearInterval(id);
  }, [activeModule, loadFixturesSchedule]);

  // Count seconds since last fixtures refresh (for "last updated X sec ago" badge)
  useEffect(() => {
    if (activeModule !== "live_matches") return;
    setFixturesSince(0);
    if (fixturesTimerRef.current) clearInterval(fixturesTimerRef.current);
    fixturesTimerRef.current = setInterval(() => setFixturesSince((s) => s + 1), 1000);
    return () => { if (fixturesTimerRef.current) clearInterval(fixturesTimerRef.current); };
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
    const filtered = fixtureSportFilter === "all"
      ? scheduleFixtures
      : scheduleFixtures.filter((fx) => (fx.sport || "Soccer") === fixtureSportFilter);
    for (const fx of filtered) {
      const s = (fx.status || "").toLowerCase();
      // Compute real-time status from starts_at_utc (avoids stale DB status between 3h syncs)
      const startMs = fx.starts_at_utc ? new Date(fx.starts_at_utc).getTime() : 0;
      const elapsed = startMs > 0 ? (now - startMs) / 60_000 : 0; // minutes since kick-off
      if (s === "finished" || elapsed > 130) finished.push(fx); // >130 min = likely done
      else if (startMs > 0 && startMs <= now) live.push(fx); // started but not finished
      else upcoming.push(fx);
    }
    // Sort live by most recently started
    live.sort((a, b) => new Date(b.starts_at_utc).getTime() - new Date(a.starts_at_utc).getTime());
    upcoming.sort((a, b) => new Date(a.starts_at_utc).getTime() - new Date(b.starts_at_utc).getTime());
    return { live, upcoming, finished };
  }, [scheduleFixtures, fixtureSportFilter]);

  const activeScheduleItems = useMemo(() => {
    if (scheduleView === "live") return scheduleGroups.live;
    if (scheduleView === "finished") return scheduleGroups.finished;
    return scheduleGroups.upcoming;
  }, [scheduleGroups, scheduleView]);

  // World Cup 2026 fixtures: filter by competition key or league name
  const wcFixtures = useMemo(() => {
    return scheduleFixtures.filter(
      (fx) =>
        fx.competition_key?.toUpperCase() === "WC" ||
        fx.league_name?.toLowerCase().includes("world cup") ||
        fx.league_name?.toLowerCase().includes("fifa")
    );
  }, [scheduleFixtures]);

  /** Free-tier UX: show last channel list from localStorage before network (stale-while-revalidate). */
  useEffect(() => {
    const c = getChannelListCache();
    if (c?.length) {
      startTransition(() => {
        setAllChannels(c);
        setLoading(false);
      });
    }
  }, []);

  useEffect(() => {
    void loadChannels(false);
  }, [loadChannels]);

  useEffect(() => {
    const id = setInterval(() => void refreshLiveMatchesOnly(), 30 * 60_000);
    return () => clearInterval(id);
  }, [refreshLiveMatchesOnly]);

  useEffect(() => {
    return () => {
      if (coldStartTimerRef.current) {
        clearTimeout(coldStartTimerRef.current);
      }
      if (coldStartCounterRef.current) {
        clearInterval(coldStartCounterRef.current);
      }
    };
  }, []);

  // Deep link: /?module=…
  const qParam = searchParams.get("q")?.trim() ?? "";
  useEffect(() => {
    if (qParam) setSearchQuery(qParam);
  }, [qParam]);

  // Deep link: /?channel_id=ID — auto-select and play a specific channel
  const channelIdParam = searchParams.get("channel_id");
  useEffect(() => {
    if (!channelIdParam || !allChannels.length) return;
    if (deepLinkAppliedRef.current === channelIdParam) return;
    const id = Number(channelIdParam);
    if (!Number.isInteger(id)) return;
    const ch = allChannels.find((c) => c.id === id);
    if (!ch) return;
    deepLinkAppliedRef.current = channelIdParam;
    startTransition(() => {
      setActiveModule(ch.module as ViewerModule);
    });
    startTransition(() => {
      setActiveChannel(ch);
    });
  }, [channelIdParam, allChannels, setActiveModule, setActiveChannel]);

  useEffect(() => {
    let m = searchParams.get("module")?.toLowerCase().trim();
    if (m === "sports") m = "global_sports";
    const allowed: ViewerModule[] = [
      "bangladesh",
      "global_sports",
      "india",
      "fast_tv",
      "live_matches",
      "world_cup_2026",
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
    () => allChannels.filter((c) => c.module === activeModule),
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

    // WC 2026: Bangladesh first, India second
    if (activeModule === "world_cup_2026") {
      list = [...list].sort((a, b) => {
        const pri = (c: typeof a) => {
          if (c.country.toLowerCase() === "bangladesh") return 0;
          if (c.country.toLowerCase() === "india") return 1;
          return 2;
        };
        return pri(a) - pri(b);
      });
    }

    // Bangladesh: Sports → News → Entertainment → Religious when no category filter active
    if (activeModule === "bangladesh" && !activeCategory && !deferredSearch.trim()) {
      const bdCatPri = (cat: string) => {
        const c = cat.toLowerCase();
        if (c.includes("sport")) return 0;
        if (c.includes("news")) return 1;
        if (c.includes("entertainment") || c.includes("drama")) return 2;
        if (c.includes("general")) return 3;
        if (c.includes("music")) return 4;
        if (c.includes("religious")) return 5;
        return 6;
      };
      list = [...list].sort((a, b) => {
        const pd = bdCatPri(a.category) - bdCatPri(b.category);
        if (pd !== 0) return pd;
        return 0;
      });
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

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of moduleChannels) {
      counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, n]) => n >= 3)
      .map(([cat]) => cat)
      .sort((a, b) => a.localeCompare(b));
  }, [moduleChannels]);
  const countryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of moduleChannels) counts.set(c.country, (counts.get(c.country) ?? 0) + 1);
    return [...counts.entries()].filter(([, n]) => n >= 2).map(([v]) => v).sort((a, b) => a.localeCompare(b));
  }, [moduleChannels]);
  const languageOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of moduleChannels) counts.set(c.language, (counts.get(c.language) ?? 0) + 1);
    return [...counts.entries()].filter(([, n]) => n >= 2).map(([v]) => v).sort((a, b) => a.localeCompare(b));
  }, [moduleChannels]);
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
          ((activeModule === "bangladesh" || activeModule === "india" || activeModule === "fast_tv") &&
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

  const channelById = useMemo(() => new Map(allChannels.map((c) => [c.id, c])), [allChannels]);

  const recentChannelObjects = useMemo(
    () => recentlyWatched.map((id) => channelById.get(id)).filter(Boolean) as Channel[],
    [recentlyWatched, channelById]
  );

  const favoriteChannelObjects = useMemo(
    () => favorites.map((id) => channelById.get(id)).filter(Boolean) as Channel[],
    [favorites, channelById]
  );

  const bdPopularChannels = useMemo(() => {
    if (activeModule !== "bangladesh") return [];
    const catOrder = (cat: string) => {
      const c = cat.toLowerCase();
      if (c.includes("sport")) return 0;
      if (c.includes("news")) return 1;
      if (c.includes("entertainment") || c.includes("drama")) return 2;
      if (c.includes("general")) return 3;
      if (c.includes("music")) return 4;
      if (c.includes("religious")) return 5;
      return 6;
    };
    return [...moduleChannels].sort((a, b) => catOrder(a.category) - catOrder(b.category)).slice(0, 12);
  }, [activeModule, moduleChannels]);

  const bdCategoryOptions = useMemo(() => {
    if (activeModule !== "bangladesh") return categoryOptions;
    const BD_CAT_ORDER = ["sports", "news", "entertainment", "drama", "general", "music", "movies", "religious", "kids", "cooking"];
    return [...categoryOptions].sort((a, b) => {
      const ai = BD_CAT_ORDER.findIndex((k) => a.toLowerCase().includes(k));
      const bi = BD_CAT_ORDER.findIndex((k) => b.toLowerCase().includes(k));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [activeModule, categoryOptions]);

  const { gsCount, inCount, bdCount, fastCount, liveCount, wcCount } = useMemo(() => {
    let gs = 0;
    let i = 0;
    let b = 0;
    let f = 0;
    let l = 0;
    let wc = 0;
    for (const c of allChannels) {
      if (c.module === "global_sports") gs += 1;
      else if (c.module === "india") i += 1;
      else if (c.module === "bangladesh") b += 1;
      else if (c.module === "fast_tv") f += 1;
      else if (c.module === "live_matches") l += 1;
      else if (c.module === "world_cup_2026") wc += 1;
    }
    return { gsCount: gs, inCount: i, bdCount: b, fastCount: f, liveCount: l, wcCount: wc };
  }, [allChannels]);

  // Sync module counts to store so Sidebar can show badges
  useEffect(() => {
    setModuleCounts({ gsCount, bdCount, inCount, fastCount, liveCount, wcCount });
  }, [gsCount, bdCount, inCount, fastCount, liveCount, wcCount, setModuleCounts]);

  // Sync search suggestions to store so TopBar dropdown can show them
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) { setSearchSuggestions([]); return; }
    const matches = allChannels.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
    setSearchSuggestions(matches);
  }, [searchQuery, allChannels, setSearchSuggestions]);

  // EPG-lite: map channel id → live fixture text for sport channels
  const liveEpgMap = useMemo(() => {
    const map = new Map<number, string>();
    const live = scheduleFixtures.filter((f) => f.status === "IN_PROGRESS" || f.status === "LIVE" || f.status === "1H" || f.status === "2H" || f.status === "HT");
    if (!live.length) return map;
    for (const ch of moduleChannels) {
      const n = ch.name.toLowerCase();
      const chCountry = ch.country.toLowerCase();
      const matched = live.find((f) => {
        const ft = `${f.home_team} ${f.away_team} ${f.league_name}`.toLowerCase();
        // Name-prefix match (≥6 chars to avoid spurious short matches)
        if (n.length >= 6 && ft.includes(n.slice(0, 6))) return true;
        // Channel country aligns with one of the playing teams
        if (chCountry.length >= 4 && (
          f.home_team.toLowerCase().includes(chCountry) ||
          f.away_team.toLowerCase().includes(chCountry) ||
          ft.includes(chCountry)
        )) return true;
        return false;
      });
      if (matched) {
        map.set(ch.id, `🔴 ${matched.home_team} vs ${matched.away_team}`);
      }
    }
    return map;
  }, [scheduleFixtures, moduleChannels]);

  // Recently added: top 10 channels by highest id (proxy for DB insertion order)
  const recentlyAdded = useMemo(() => {
    if (activeModule !== "global_sports" && activeModule !== "bangladesh" && activeModule !== "india") return [];
    return [...moduleChannels].sort((a, b) => b.id - a.id).slice(0, 10);
  }, [activeModule, moduleChannels]);

  // Swipe gesture: left/right to cycle modules
  const swipeContainerRef = useRef<HTMLDivElement | null>(null);
  const onSwipe = useCallback((dir: "left" | "right" | "up" | "down") => {
    if (dir !== "left" && dir !== "right") return;
    const idx = MODULE_ORDER.indexOf(activeModule);
    if (idx === -1) return;
    const next = dir === "left"
      ? MODULE_ORDER[(idx + 1) % MODULE_ORDER.length]!
      : MODULE_ORDER[(idx - 1 + MODULE_ORDER.length) % MODULE_ORDER.length]!;
    transitionSetActiveModule(next);
    const label = next.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    toast(`📺 ${label}`, { duration: 1200 });
  }, [activeModule, transitionSetActiveModule]);
  useSwipeGesture(swipeContainerRef, onSwipe);

  return (
    <>
    <AppShell searchQuery={searchQuery} onSearch={setSearchQuery}>
      <div ref={swipeContainerRef} className="mx-auto w-full max-w-[1920px] space-y-4 sm:space-y-5 md:space-y-6">

        {/* ── Cold-start banner ── */}
        <AnimatePresence>
          {coldStart && !coldStartDismissed && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.3)" }}
            >
              <RefreshCw size={15} className="shrink-0 animate-spin" style={{ color: "var(--primary-accent)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-snug" style={{ color: "var(--text-main)" }}>
                  🚀 Backend starting up…
                </p>
                <p className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>
                  {coldStartSeconds < 15
                    ? "Waking up the server — usually takes 10–30 seconds on first load."
                    : coldStartSeconds < 40
                      ? "Still loading… Free-tier servers take a moment to start. Almost there!"
                      : "Taking longer than usual. Please wait or refresh if this persists."}
                </p>
                {coldStartSeconds > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(245,166,35,0.15)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ background: "var(--primary-accent)", width: `${Math.min(100, (coldStartSeconds / 60) * 100)}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums font-bold" style={{ color: "var(--primary-accent)" }}>
                      {coldStartSeconds}s / ~60s
                    </span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setColdStartDismissed(true)}
                className="shrink-0 rounded p-1 hover:bg-white/10"
                style={{ color: "var(--text-muted)" }}
                aria-label={t("coldStartDismiss")}
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

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
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "#f87171" }} aria-hidden />
              Live Matches
            </span>
            {liveCount > 0 && <span className="module-tab-badge">{liveCount}</span>}
          </button>
          <button
            type="button"
            onClick={() => {
              transitionSetActiveModule("world_cup_2026");
            }}
            className={`module-tab shrink-0 snap-start${activeModule === "world_cup_2026" ? " active" : ""}`}
            style={activeModule === "world_cup_2026" ? { background: "rgba(245,166,35,0.15)", borderColor: "rgba(245,166,35,0.5)" } : {}}
          >
            🏆 World Cup 2026
            {wcCount > 0 && <span className="module-tab-badge">{wcCount}</span>}
          </button>
        </div>

        {/* ── Live Matches: full premium standalone view ── */}
        {activeModule === "live_matches" && (
          <div className="space-y-4">
            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}
                >
                  <span className="text-xl" aria-hidden>🔴</span>
                </div>
                <div>
                  <h1 className="text-lg font-black tracking-tight" style={{ color: "var(--text-main)" }}>
                    Live Match Schedule
                  </h1>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    ⚽ Football · 🏏 Cricket · Real-time fixtures
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {scheduleUpdated && (
                  <span className="hidden sm:inline text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {fixturesSince < 60 ? `${fixturesSince}s ago` : `${Math.floor(fixturesSince / 60)}m ago`}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => { setFixturesSince(0); void loadFixturesSchedule(); }}
                  disabled={fixturesLoading}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition hover:opacity-80 active:scale-95"
                  style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)", color: "var(--primary-accent)" }}
                >
                  <RefreshCw size={13} className={fixturesLoading ? "animate-spin" : ""} />
                  <span className="hidden xs:inline">{fixturesLoading ? "…" : "Refresh"}</span>
                </button>
              </div>
            </div>

            {/* ── Stats tiles (tap to switch view) ── */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setScheduleView("live")}
                className="fixture-stat-tile"
                style={{
                  background: scheduleView === "live" ? "rgba(239,68,68,0.12)" : "var(--bg-card)",
                  borderColor: scheduleView === "live" ? "rgba(239,68,68,0.4)" : "var(--border)",
                }}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {scheduleGroups.live.length > 0 && (
                    <span className="pulse-dot" style={{ background: "#f87171", width: 7, height: 7 }} aria-hidden />
                  )}
                  <span className="text-2xl font-black tabular-nums" style={{ color: "#f87171" }}>
                    {scheduleGroups.live.length}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#f87171" }}>
                  LIVE NOW
                </p>
              </button>
              <button
                type="button"
                onClick={() => setScheduleView("upcoming")}
                className="fixture-stat-tile"
                style={{
                  background: scheduleView === "upcoming" ? "rgba(245,166,35,0.1)" : "var(--bg-card)",
                  borderColor: scheduleView === "upcoming" ? "rgba(245,166,35,0.4)" : "var(--border)",
                }}
              >
                <span className="text-2xl font-black tabular-nums" style={{ color: "var(--primary-accent)" }}>
                  {scheduleGroups.upcoming.length}
                </span>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  UPCOMING
                </p>
              </button>
              <button
                type="button"
                onClick={() => setScheduleView("finished")}
                className="fixture-stat-tile"
                style={{
                  background: scheduleView === "finished" ? "rgba(160,160,176,0.1)" : "var(--bg-card)",
                  borderColor: scheduleView === "finished" ? "rgba(160,160,176,0.35)" : "var(--border)",
                }}
              >
                <span className="text-2xl font-black tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {scheduleGroups.finished.length}
                </span>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  FINISHED
                </p>
              </button>
            </div>

            {/* ── Sport filter — only when cricket data exists ── */}
            {scheduleFixtures.some((fx) => fx.sport === "Cricket") && (
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5" data-swipe-ignore="true">
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Sport:
                </span>
                {(["all", "Soccer", "Cricket"] as const).map((sport) => (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => setFixtureSportFilter(sport)}
                    className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition"
                    style={{
                      background: fixtureSportFilter === sport ? "rgba(245,166,35,0.18)" : "rgba(255,255,255,0.04)",
                      border: fixtureSportFilter === sport ? "1px solid rgba(245,166,35,0.4)" : "1px solid var(--border)",
                      color: fixtureSportFilter === sport ? "var(--primary-accent)" : "var(--text-muted)",
                    }}
                  >
                    {sport === "all" ? "🌐 All" : sport === "Soccer" ? "⚽ Football" : "🏏 Cricket"}
                  </button>
                ))}
              </div>
            )}

            {/* ── Fixture list ── */}
            <div className="space-y-2.5">
              {fixturesLoading && activeScheduleItems.length === 0 ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} />
                  ))}
                </div>
              ) : activeScheduleItems.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl py-14 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <span className="text-3xl" aria-hidden>📅</span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{t("scheduleEmptyByStatus")}</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Switch to a different tab above</p>
                  </div>
                </div>
              ) : (
                activeScheduleItems.slice(0, 48).map((fx) => {
                  const startMs = fx.starts_at_utc ? new Date(fx.starts_at_utc).getTime() : 0;
                  const nowMs = Date.now();
                  const elapsedMin = startMs > 0 ? Math.floor((nowMs - startMs) / 60_000) : 0;
                  const isReallyLive = startMs > 0 && startMs <= nowMs && (fx.status || "").toLowerCase() !== "finished" && elapsedMin <= 130;
                  const isFinished = (fx.status || "").toLowerCase() === "finished" || elapsedMin > 130;
                  const sportIcon = fx.sport === "Cricket" ? "🏏" : fx.sport === "Soccer" ? "⚽" : "🏆";
                  return (
                    <div
                      key={fx.id}
                      className={`fixture-card${isReallyLive ? " live" : ""}`}
                    >
                      {/* Top strip: competition + status */}
                      <div
                        className="flex items-center justify-between gap-2 px-4 py-2"
                        style={{
                          background: isReallyLive ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.02)",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                          {sportIcon} {fx.league_name}
                        </span>
                        <span
                          className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                          style={{
                            background: isReallyLive ? "rgba(239,68,68,0.15)" : isFinished ? "rgba(120,120,120,0.12)" : "rgba(245,166,35,0.12)",
                            color: isReallyLive ? "#f87171" : isFinished ? "var(--text-muted)" : "var(--primary-accent)",
                            border: `1px solid ${isReallyLive ? "rgba(239,68,68,0.35)" : isFinished ? "rgba(120,120,120,0.2)" : "rgba(245,166,35,0.3)"}`,
                          }}
                        >
                          {isReallyLive ? "🔴 LIVE" : isFinished ? "✓ FT" : "⏰ Soon"}
                        </span>
                      </div>

                      {/* Teams + info */}
                      <div className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {/* Home team */}
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            {fx.thumb_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={fx.thumb_url} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-lg object-cover" style={{ border: "1px solid var(--border)" }} />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black" style={{ background: isReallyLive ? "rgba(239,68,68,0.12)" : "var(--bg-hover)", color: isReallyLive ? "#f87171" : "var(--text-muted)" }}>
                                {fx.home_team.slice(0, 1)}
                              </div>
                            )}
                            <p className="min-w-0 truncate text-sm font-bold" style={{ color: "var(--text-main)" }}>{fx.home_team}</p>
                          </div>

                          {/* VS / elapsed */}
                          <div className="flex shrink-0 flex-col items-center gap-0.5 px-2">
                            {isReallyLive ? (
                              <>
                                <span className="text-[11px] font-black tabular-nums" style={{ color: "#f87171" }}>{elapsedMin}&apos;</span>
                                <span className="pulse-dot" style={{ background: "#f87171", width: 6, height: 6 }} aria-hidden />
                              </>
                            ) : (
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>VS</span>
                            )}
                          </div>

                          {/* Away team */}
                          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                            <p className="min-w-0 truncate text-right text-sm font-bold" style={{ color: "var(--text-main)" }}>{fx.away_team}</p>
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black" style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>
                              {fx.away_team.slice(0, 1)}
                            </div>
                          </div>
                        </div>

                        {/* Time row */}
                        <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {isReallyLive ? (
                            <span className="font-semibold" style={{ color: "#f87171" }}>Match in progress</span>
                          ) : (
                            <span>
                              🕐 {new Date(fx.starts_at_utc).toLocaleString(undefined, FIXTURE_TIME_FORMAT)}
                            </span>
                          )}
                          {fx.data_attribution ? <span>· {fx.data_attribution}</span> : null}
                        </div>

                        {/* Channel suggestions — only real matched channels */}
                        {fx.suggested_channels?.length ? (
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span className="shrink-0 text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>📺 Watch:</span>
                            {fx.suggested_channels.slice(0, 5).map((ch) => (
                              <button
                                key={`${fx.id}-${ch.id}`}
                                type="button"
                                onClick={() => {
                                  transitionSetActiveModule(ch.module as ViewerModule);
                                  selectChannel(ch);
                                  toast.success(`▶ ${ch.name}`, { description: "Switching to channel…" });
                                  setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
                                }}
                                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-90 active:scale-95"
                                style={{
                                  background: isReallyLive ? "rgba(239,68,68,0.1)" : "rgba(245,166,35,0.1)",
                                  border: `1px solid ${isReallyLive ? "rgba(239,68,68,0.25)" : "rgba(245,166,35,0.25)"}`,
                                  color: isReallyLive ? "#f87171" : "var(--primary-accent)",
                                }}
                                title={ch.name}
                              >
                                ▶ {ch.name}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* No fixtures at all — configuration guidance */}
            {!fixturesLoading && scheduleFixtures.length === 0 && (
              <div className="flex flex-col items-center gap-4 rounded-xl py-16 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <span className="text-4xl" aria-hidden>📡</span>
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{t("scheduleEmpty")}</p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    Set FOOTBALL_DATA_ORG_API_TOKEN &amp; CRICAPI_KEY in your backend environment to load live fixtures.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setFixturesSince(0); void loadFixturesSchedule(); }}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition hover:opacity-90 active:scale-95"
                  style={{ background: "var(--primary-accent)", color: "#0a0a0f" }}
                >
                  <RefreshCw size={14} /> Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── World Cup 2026 Hero Banner ── */}
        {activeModule === "world_cup_2026" && (
          <div
            className="relative overflow-hidden rounded-xl p-5 sm:p-6"
            style={{
              background: "linear-gradient(135deg, rgba(120,53,15,0.35) 0%, rgba(245,166,35,0.18) 50%, rgba(120,53,15,0.25) 100%)",
              border: "1px solid rgba(245,166,35,0.45)",
            }}
          >
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #F5A623 0%, transparent 55%), radial-gradient(circle at 80% 50%, #E53935 0%, transparent 55%)" }} />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl sm:h-20 sm:w-20"
                  style={{ background: "rgba(245,166,35,0.15)", border: "2px solid rgba(245,166,35,0.45)", boxShadow: "0 4px 20px rgba(245,166,35,0.2)" }}
                >
                  🏆
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.5)", color: "#f87171" }}>
                      🔴 LIVE NOW
                    </span>
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.4)", color: "var(--primary-accent)" }}>
                      FIFA 2026
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-xl font-black tracking-tight sm:text-2xl" style={{ color: "var(--text-main)" }}>
                    FIFA World Cup 2026
                  </h2>
                  <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
                    🇺🇸 USA · 🇨🇦 Canada · 🇲🇽 Mexico · June 11 – July 19, 2026
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    48 দল · 104 ম্যাচ · সরাসরি সম্প্রচার
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: "rgba(245,166,35,0.12)", color: "var(--primary-accent)", border: "1px solid rgba(245,166,35,0.3)" }}>
                    ⚽ 48 Teams
                  </span>
                  <span className="rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: "rgba(245,166,35,0.12)", color: "var(--primary-accent)", border: "1px solid rgba(245,166,35,0.3)" }}>
                    📺 {wcCount} Channels
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── WC 2026 Fixture Schedule ── */}
        {activeModule === "world_cup_2026" && (
          <WorldCupSchedule
            fixtures={wcFixtures}
            loading={fixturesLoading}
            onRefresh={() => { setFixturesSince(0); void loadFixturesSchedule(); }}
            onSelectChannel={selectChannel}
            onModuleChange={transitionSetActiveModule}
          />
        )}

        {/* ── Channel grid + player (hidden in Live Matches mode) ── */}
        {activeModule !== "live_matches" && (<>

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
                      : activeModule === "world_cup_2026"
                        ? "FIFA WORLD CUP 2026"
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
                    : activeModule === "world_cup_2026"
                      ? "🏆 FIFA World Cup 2026 — Live Channels"
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

        {/* ── Bangladesh Popular Channels Quick Row ── */}
        {activeModule === "bangladesh" && !loading && bdPopularChannels.length > 0 && (
          <div className="overflow-hidden rounded-2xl" style={{ background: "rgba(0,106,78,0.07)", border: "1px solid rgba(0,106,78,0.18)" }}>
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none" aria-hidden>⭐</span>
                <h3 className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: "#10b981" }}>জনপ্রিয় চ্যানেল</h3>
              </div>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>ক্লিক করে দেখুন →</span>
            </div>
            <div className="relative">
              <div className="flex gap-1 overflow-x-auto px-3 pb-3 scrollbar-none" data-swipe-ignore="true">
                {bdPopularChannels.map((ch) => {
                  const isActive = activeChannel?.id === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => selectChannel(ch)}
                      className="group flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-2 py-2 text-center transition-all hover:scale-105"
                      style={{
                        width: 72,
                        background: isActive ? "rgba(0,106,78,0.2)" : "rgba(255,255,255,0.03)",
                        border: isActive ? "1px solid rgba(16,185,129,0.45)" : "1px solid rgba(255,255,255,0.05)",
                      }}
                      title={ch.name}
                    >
                      {ch.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ch.logo_url}
                          alt=""
                          className="h-12 w-12 rounded-xl object-cover transition-transform group-hover:scale-105"
                          style={{ border: isActive ? "2px solid #10b981" : "1px solid rgba(255,255,255,0.08)" }}
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl text-xs font-black"
                          style={{ background: "rgba(0,106,78,0.2)", color: "#10b981" }}>
                          {ch.name.slice(0, 2)}
                        </div>
                      )}
                      <p className="w-full truncate text-[9px] font-semibold leading-tight"
                        style={{ color: isActive ? "#10b981" : "var(--text-muted)" }}>
                        {ch.name}
                      </p>
                      {isActive && (
                        <span className="h-1 w-4 rounded-full" style={{ background: "#10b981" }} aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-10"
                style={{ background: "linear-gradient(to right, transparent, rgba(0,106,78,0.07))" }} />
            </div>
          </div>
        )}

        {/* ── AdSlot banner ── */}
        {tier === "free" && <AdSlot variant="banner" />}

        {/* ── FAST TV info card ── */}
        {activeModule === "fast_tv" && (
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)" }}
          >
            <span className="shrink-0 text-2xl" aria-hidden>⚡</span>
            <div className="min-w-0">
              <p className="text-xs font-bold" style={{ color: "var(--primary-accent)" }}>FAST TV — Free 24/7 Channels</p>
              <p className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>
                FAST TV runs continuously — no login or subscription needed. Tap any channel to start watching instantly.
              </p>
            </div>
          </div>
        )}

        {/* ── Category / Sport-type tabs ── */}
        {activeModule === "global_sports" ? (
          /* Sports module: smart sport-type chips (auto-filtered, only non-empty) */
          <div className="space-y-1.5">
          <p className="px-0.5 text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>{t("sportFilterHint")}</p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" data-swipe-ignore="true">
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
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" data-swipe-ignore="true">
            <button
              type="button"
              className={`cat-tab${activeCategory === "" ? " active" : ""}`}
              onClick={() => {
                transitionSetActiveCategory("");
              }}
            >
              📺 {t("filterAll")}
            </button>
            {(activeModule === "bangladesh" ? bdCategoryOptions : categoryOptions).map((cat) => (
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

          {/* Player — hidden on mobile until a channel is selected */}
          <section className={`min-w-0 md:col-span-7 lg:col-span-8 ${!activeChannel ? "hidden md:block" : ""}`}>
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
                className="mt-2 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Logo */}
                  {activeChannel.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeChannel.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain bg-white sm:h-10 sm:w-10" style={{ border: "1px solid var(--border)" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white sm:h-10 sm:w-10" style={{ background: "var(--primary-accent)" }}>
                      {activeChannel.name.slice(0, 1)}
                    </div>
                  )}
                  {/* Channel info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--primary-accent)" }}>{t("nowPlaying")}</p>
                    <p className="truncate text-sm font-bold leading-tight" style={{ color: "var(--text-main)" }}>{activeChannel.name}</p>
                    <p className="truncate text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {flagFromCountryName(activeChannel.country)} {activeChannel.country} · {activeChannel.quality_tag.toUpperCase()}
                    </p>
                  </div>
                  {/* Actions — LIVE badge + share */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs" style={{ background: "rgba(245,166,35,0.12)", color: "var(--primary-accent)", border: "1px solid rgba(245,166,35,0.35)" }}>
                      <span className="pulse-dot" style={{ width: 5, height: 5 }} /> LIVE
                    </span>
                    <button
                      type="button"
                      title={t("shareChannel")}
                      onClick={async () => {
                        if (!activeChannel) return;
                        const url = `${window.location.origin}/?channel_id=${activeChannel.id}`;
                        try {
                          if (navigator.share) {
                            await navigator.share({ title: activeChannel.name, url });
                          } else {
                            await navigator.clipboard.writeText(url);
                            toast.success(t("shareCopied"));
                          }
                        } catch { /* user cancelled or no clipboard */ }
                      }}
                      className="flex items-center justify-center gap-1 rounded-full p-1.5 text-xs font-semibold transition hover:opacity-80 sm:gap-1.5 sm:px-2.5 sm:py-1"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                      aria-label={t("shareChannel")}
                    >
                      <Share2 size={12} />
                      <span className="hidden sm:inline">{t("shareChannel")}</span>
                    </button>
                  </div>
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
                        <img src={ch.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain bg-white" style={{ border: "1px solid var(--border)" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
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

        {/* ── Favorites ── */}
        {favoriteChannelObjects.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid rgba(245,166,35,0.25)" }}>
            <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-sm" aria-hidden>⭐</span>
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-main)" }}>
                  Favorites
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFavorites([]);
                  try { localStorage.removeItem("gstv-favorites"); } catch { /* ignore */ }
                }}
                className="text-[10px] transition hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                {t("recentlyClear")}
              </button>
            </div>
            <div className="relative">
              <div className="flex gap-0 overflow-x-auto scrollbar-none divide-x" data-swipe-ignore="true" style={{ borderColor: "var(--border)" }}>
              {favoriteChannelObjects.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => selectChannel(ch)}
                  className="flex shrink-0 flex-col items-center gap-1.5 px-4 py-3 text-center transition hover:bg-white/[0.04]"
                  style={{ minWidth: 80, maxWidth: 96 }}
                  title={ch.name}
                >
                  {ch.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ch.logo_url} alt="" className="h-10 w-10 rounded-lg object-contain bg-white"
                      style={{ border: "1px solid rgba(245,166,35,0.3)" }} loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold"
                      style={{ background: "rgba(245,166,35,0.12)", color: "var(--primary-accent)" }}>
                      {ch.name.slice(0, 2)}
                    </div>
                  )}
                  <p className="w-full truncate text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                    {ch.name}
                  </p>
                </button>
              ))}
              </div>
              {/* fade-out scroll hint on right edge */}
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-xl" style={{ background: "linear-gradient(to right, transparent, var(--bg-card))" }} />
            </div>
          </div>
        )}

        {/* ── Recently Watched ── */}
        {recentChannelObjects.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <Clock size={14} style={{ color: "var(--primary-accent)" }} />
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-main)" }}>
                  {t("recentlyWatched")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRecentlyWatched([]);
                  try { localStorage.removeItem("gstv-recently-watched"); } catch { /* ignore */ }
                }}
                className="text-[10px] transition hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                {t("recentlyClear")}
              </button>
            </div>
            <div className="relative">
              <div className="flex gap-0 overflow-x-auto scrollbar-none divide-x" data-swipe-ignore="true" style={{ borderColor: "var(--border)" }}>
              {recentChannelObjects.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => selectChannel(ch)}
                  className="flex shrink-0 flex-col items-center gap-1.5 px-4 py-3 text-center transition hover:bg-white/[0.04]"
                  style={{ minWidth: 80, maxWidth: 96 }}
                  title={ch.name}
                >
                  {ch.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ch.logo_url} alt="" className="h-10 w-10 rounded-lg object-contain bg-white"
                      style={{ border: "1px solid var(--border)" }} loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold"
                      style={{ background: "var(--bg-hover)", color: "var(--primary-accent)" }}>
                      {ch.name.slice(0, 2)}
                    </div>
                  )}
                  <p className="w-full truncate text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                    {ch.name}
                  </p>
                </button>
              ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-xl" style={{ background: "linear-gradient(to right, transparent, var(--bg-card))" }} />
            </div>
          </div>
        )}

        {/* ── Full channel grid ── */}
        <section id="channel-grid">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
              {activeModule === "global_sports" && activeCategory
                ? SPORT_TYPES.find((s) => s.id === activeCategory)?.label ?? "🌐 " + t("directory")
                : (activeModule === "bangladesh" ||
                    activeModule === "india" ||
                    activeModule === "fast_tv") &&
                    activeCategory
                  ? `${categoryEmoji(activeCategory, activeModule)} ${activeCategory}`
                  : activeModule === "bangladesh"
                    ? "🇧🇩 Bangladesh TV Channels"
                    : activeModule === "india"
                      ? "🇮🇳 India TV Channels"
                      : activeModule === "fast_tv"
                        ? "⚡ FAST TV (24/7)"
                        : activeModule === "world_cup_2026"
                          ? "🏆 World Cup 2026 Live Channels"
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

          {error && !loading ? (
            <div className="rounded-xl p-10 text-center" style={{ background: "var(--bg-card)", border: "1px solid rgba(229,57,53,0.25)" }}>
              <AlertTriangle className="mx-auto mb-3 h-8 w-8" style={{ color: "#f87171" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{t("errorLoadFail")}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{error}</p>
              <button
                type="button"
                onClick={() => void loadChannels(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition hover:opacity-90"
                style={{ background: "var(--primary-accent)", color: "#0a0a0f" }}
              >
                <RefreshCw size={14} /> {t("errorRetry")}
              </button>
            </div>
          ) : loading ? (
            <ChannelSkeletonGrid count={Math.min(moduleChannels.length || CHANNEL_GRID_BATCH, CHANNEL_GRID_BATCH)} />
          ) : moduleChannels.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl p-12 text-center" style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl text-4xl"
                style={{ background: "rgba(229,9,20,0.08)", border: "1px solid rgba(229,9,20,0.15)" }}>
                {activeModule === "bangladesh" ? "🇧🇩" : activeModule === "india" ? "🇮🇳" : activeModule === "world_cup_2026" ? "🏆" : "📡"}
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                  {activeModule === "bangladesh" ? "বাংলাদেশ চ্যানেল লোড হচ্ছে…" : activeModule === "india" ? "India channels loading…" : activeModule === "world_cup_2026" ? "World Cup channels loading…" : t("emptyModule")}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>চ্যানেল না দেখালে Refresh করুন</p>
              </div>
              <button type="button" onClick={() => void loadChannels(true)} disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--primary-accent)", color: "#fff" }}>
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> {loading ? "লোড হচ্ছে…" : "Refresh"}
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl p-12 text-center" style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                🔍
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{t("noResults")}</p>
                <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>{t("tryAdjust")}</p>
              </div>
              {hasActiveFilters && (
                <button type="button" onClick={clearAllFilters}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition hover:opacity-90"
                  style={{ background: "var(--primary-accent)", color: "#fff" }}>
                  {t("noResultsCta")}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* ── Recently Added row ── */}
              {recentlyAdded.length > 0 && !deferredSearch && !activeCategory && (
                <div className="overflow-hidden rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none" aria-hidden>✨</span>
                      <h3 className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: "var(--primary-accent)" }}>নতুন চ্যানেল</h3>
                    </div>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Recently added →</span>
                  </div>
                  <div className="relative">
                    <div className="flex gap-2 overflow-x-auto px-4 pb-4 scrollbar-none" data-swipe-ignore="true">
                      {recentlyAdded.map((ch) => {
                        const isActive = activeChannel?.id === ch.id;
                        return (
                          <button key={ch.id} type="button" onClick={() => selectChannel(ch)}
                            className="group flex shrink-0 flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-all hover:scale-105"
                            style={{ width: 72, background: isActive ? "rgba(229,9,20,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${isActive ? "rgba(229,9,20,0.4)" : "rgba(255,255,255,0.05)"}` }}>
                            {ch.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={ch.logo_url} alt="" className="h-11 w-11 rounded-xl object-contain" loading="lazy" style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
                            ) : (
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl text-xs font-black" style={{ background: "rgba(229,9,20,0.1)", color: "var(--primary-accent)" }}>{ch.name.slice(0, 2)}</div>
                            )}
                            <p className="w-full truncate text-[9px] font-medium" style={{ color: isActive ? "var(--primary-accent)" : "var(--text-muted)" }}>{ch.name}</p>
                          </button>
                        );
                      })}
                    </div>
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-10" style={{ background: "linear-gradient(to right, transparent, var(--bg-card))" }} />
                  </div>
                </div>
              )}


              <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 md:gap-3 lg:grid-cols-5 lg:gap-4 xl:grid-cols-6 2xl:grid-cols-8">
                {gridSlice.map((ch) => (
                  <PremiumChannelCard
                    key={ch.id}
                    channel={ch}
                    active={activeChannel?.id === ch.id}
                    onSelect={selectChannel}
                    activeModule={activeModule}
                    isFavorited={favorites.includes(ch.id)}
                    onToggleFavorite={toggleFavorite}
                    onShare={shareChannel}
                    highlight={deferredSearch}
                    epgText={liveEpgMap.get(ch.id) ?? null}
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
        </>)}
      </div>
    </AppShell>
    </>
  );
}

/* ── Highlight matching text in search results ── */
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "rgba(229,9,20,0.35)", color: "#fff", borderRadius: 2, padding: "0 1px" }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/* ── Premium Channel Card ── */
const PremiumChannelCard = memo(function PremiumChannelCard({
  channel,
  active,
  onSelect,
  activeModule,
  isFavorited,
  onToggleFavorite,
  onShare,
  highlight,
  epgText,
}: {
  channel: Channel;
  active: boolean;
  onSelect: (c: Channel) => void;
  activeModule: ViewerModule;
  isFavorited: boolean;
  onToggleFavorite: (c: Channel) => void;
  onShare: (c: Channel) => void;
  highlight?: string;
  epgText?: string | null;
}) {
  const isHD =
    channel.quality_tag.toLowerCase().includes("hd") ||
    channel.quality_tag.toLowerCase().includes("fhd") ||
    channel.quality_tag.toLowerCase().includes("4k") ||
    channel.quality_tag.toLowerCase().includes("1080");

  return (
    <div className={`ch-card group w-full${active ? " active" : ""}`}>
      <button
        type="button"
        onClick={() => onSelect(channel)}
        className="w-full text-left"
        aria-label={channel.name}
      >
        {/* ── Thumbnail ── */}
        <div
          className="relative w-full overflow-hidden"
          style={{
            aspectRatio: "1 / 1",
            background: active
              ? "linear-gradient(135deg,rgba(229,9,20,0.18),rgba(229,9,20,0.06))"
              : "var(--bg-hover)",
          }}
        >
          {channel.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={channel.logo_url}
              alt=""
              className="absolute inset-0 h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                const t = e.currentTarget;
                t.style.display = "none";
                const fb = t.nextElementSibling as HTMLElement | null;
                if (fb) fb.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className="absolute inset-0 flex-col items-center justify-center gap-1"
            style={{
              background: "linear-gradient(135deg,rgba(14,18,32,0.95) 0%,rgba(20,12,28,0.9) 100%)",
              display: channel.logo_url ? "none" : "flex",
            }}
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black"
              style={{
                background: "linear-gradient(135deg,rgba(229,9,20,0.18),rgba(245,166,35,0.12))",
                border: "1.5px solid rgba(245,166,35,0.25)",
                color: "var(--primary-accent)",
                boxShadow: "0 4px 16px rgba(229,9,20,0.18)",
              }}
            >
              {channel.name.replace(/\s*\[.*?\]/g, "").slice(0, 2).toUpperCase()}
            </span>
          </div>

          {/* LIVE overlay when active */}
          {active && (
            <div className="absolute inset-0 flex items-end justify-center pb-2"
              style={{ background: "linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 60%)" }}>
              <span className="live-badge text-[9px]">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" /> LIVE
              </span>
            </div>
          )}

          {/* EPG live match badge */}
          {!active && epgText && (
            <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1.5"
              style={{ background: "linear-gradient(to top,rgba(0,0,0,0.8) 0%,transparent 100%)" }}>
              <p className="truncate text-[8px] font-bold leading-tight" style={{ color: "#fbbf24" }}>{epgText}</p>
            </div>
          )}


          {/* HD badge */}
          {isHD && (
            <span
              className="absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider"
              style={{ background: "rgba(16,185,129,0.92)", color: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }}
            >
              HD
            </span>
          )}

          {/* Action buttons: favorite + share (show on hover) */}
          <div className="absolute right-1 top-1 flex flex-col gap-1 opacity-0 transition-all group-hover:opacity-100">
            <button
              type="button"
              aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(channel); }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs transition hover:scale-110"
              style={{ background: isFavorited ? "rgba(245,166,35,0.9)" : "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(6px)" }}
            >
              {isFavorited ? "⭐" : "☆"}
            </button>
            <button
              type="button"
              aria-label="Share channel"
              onClick={(e) => { e.stopPropagation(); onShare(channel); }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs transition hover:scale-110"
              style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(6px)", color: "#94A3B8" }}
            >
              <Share2 size={10} />
            </button>
          </div>
        </div>

        {/* ── Info ── */}
        <div className="px-2 py-1.5">
          <p
            className="truncate text-[11px] font-semibold leading-tight"
            style={{ color: active ? "var(--primary-accent)" : "var(--text-main)" }}
            title={channel.name.replace(/\s*\[.*?\]/g, "").trim()}
          >
            <HighlightText text={channel.name.replace(/\s*\[.*?\]/g, "").trim()} query={highlight ?? ""} />
          </p>
          <p className="mt-0.5 flex items-center gap-0.5 truncate text-[9px] leading-none" style={{ color: "var(--text-muted)" }}>
            <span className="shrink-0">{flagFromCountryName(channel.country)}</span>
            <span className="truncate">{categoryEmoji(channel.category, activeModule)} {channel.category}</span>
          </p>
        </div>
      </button>
    </div>
  );
});


