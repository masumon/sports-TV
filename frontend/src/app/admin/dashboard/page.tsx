"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  Clock,
  Filter,
  Home,
  LogOut,
  Megaphone,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Users,
  X,
  Tv2,
  Database,
} from "lucide-react";
import Image from "next/image";
import { apiClient } from "@/lib/apiClient";
import type { AdminStats, Channel, StreamProbeItem, StreamProbeStatus } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";
import { useSiteSettingsStore } from "@/store/siteSettingsStore";

type ChannelFormState = {
  name: string;
  country: string;
  category: string;
  language: string;
  logo_url: string;
  stream_url: string;
  quality_tag: string;
  module: string;
};

function normProbeKey(u: string): string {
  try {
    const x = new URL(u.trim());
    x.hash = "";
    return x.toString();
  } catch {
    return u.trim();
  }
}

function aggregateProbeStatus(
  channel: Channel,
  probeByUrl: Record<string, StreamProbeItem>
): StreamProbeStatus | "unknown" {
  const urls = [channel.stream_url, ...(channel.alternate_urls ?? [])].filter(
    (x): x is string => Boolean(x && String(x).trim().startsWith("http"))
  );
  let alive = false;
  let geo = false;
  let dead = false;
  let anyChecked = false;
  for (const u of urls) {
    const p = probeByUrl[normProbeKey(u)];
    if (!p) continue;
    anyChecked = true;
    if (p.status === "alive") alive = true;
    if (p.status === "geo_blocked") geo = true;
    if (p.status === "dead") dead = true;
  }
  if (!anyChecked) return "unknown";
  if (alive) return "alive";
  if (geo) return "geo_blocked";
  if (dead) return "dead";
  return "unknown";
}

const columnHelper = createColumnHelper<Channel>();

const initialChannelForm: ChannelFormState = {
  name: "",
  country: "Global",
  category: "Sports",
  language: "Unknown",
  logo_url: "",
  stream_url: "",
  quality_tag: "auto",
  module: "global_sports",
};

export default function AdminDashboardPage() {
  const { token, user, clearSession } = useAuthStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const initialFetchDone = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelForm, setChannelForm] = useState<ChannelFormState>(initialChannelForm);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [viewerCatalogTotal, setViewerCatalogTotal] = useState<number | null>(null);
  const [channelQuery, setChannelQuery] = useState("");
  const [channelModuleFilter, setChannelModuleFilter] = useState<"all" | "global_sports" | "india" | "bangladesh">("all");
  const [probeByUrl, setProbeByUrl] = useState<Record<string, StreamProbeItem>>({});

  const authToken = token;

  const filteredAdminChannels = useMemo(() => {
    const q = channelQuery.trim().toLowerCase();
    return channels.filter((c) => {
      if (channelModuleFilter !== "all" && c.module !== channelModuleFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.language.toLowerCase().includes(q) ||
        c.stream_url.toLowerCase().includes(q)
      );
    });
  }, [channels, channelQuery, channelModuleFilter]);

  useEffect(() => {
    if (!authToken || channels.length === 0) {
      setProbeByUrl({});
      return;
    }
    let cancelled = false;
    const run = async () => {
      const uniq = new Set<string>();
      for (const c of channels) {
        for (const u of [c.stream_url, ...(c.alternate_urls ?? [])]) {
          const s = (u || "").trim();
          if (s.startsWith("http")) uniq.add(s);
        }
      }
      const list = [...uniq];
      const map: Record<string, StreamProbeItem> = {};
      const batch = 24;
      try {
        for (let i = 0; i < list.length; i += batch) {
          const slice = list.slice(i, i + batch);
          const res = await apiClient.adminProbeStreams(authToken, slice);
          if (cancelled) return;
          for (const r of res.results) {
            map[normProbeKey(r.url)] = r;
          }
        }
        if (!cancelled) setProbeByUrl(map);
      } catch {
        if (!cancelled) setProbeByUrl({});
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [authToken, channels]);

  const setFormError = (message: string) => {
    setError(message);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validateUrl = (
    value: string,
    label: string,
    required = true,
    allowedProtocols = ["http:", "https:"]
  ): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (required) setFormError(`${label} is required.`);
      return !required;
    }
    try {
      const url = new URL(trimmed);
      if (!allowedProtocols.includes(url.protocol)) {
        setFormError(`${label} must start with ${allowedProtocols.map((protocol) => protocol.replace(":", "://")).join(", ")}.`);
        return false;
      }
      return true;
    } catch {
      setFormError(`${label} must be a valid URL.`);
      return false;
    }
  };

  const fetchAdminData = async () => {
    if (!authToken) return;
    if (!initialFetchDone.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const channelRes = await apiClient.adminListChannels(authToken);
      setChannels(channelRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড করা যায়নি");
    } finally {
      setLoading(false);
      setRefreshing(false);
      initialFetchDone.current = true;
    }
  };

  const fetchStats = async () => {
    if (!authToken) return;
    try {
      setStats(await apiClient.adminStats(authToken));
    } catch {
      /* optional */
    }
  };

  const fetchViewerCatalogCount = async () => {
    if (!authToken) return;
    try {
      const s = await apiClient.adminStats(authToken);
      setViewerCatalogTotal(s.active_channels);
    } catch {
      setViewerCatalogTotal(null);
    }
  };

  useEffect(() => {
    if (!authToken) return;
    void fetchAdminData();
    void fetchStats();
    void fetchViewerCatalogCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  // Auto-refresh admin data every 5 min when logged in.
  // NOTE: M3U channel sync runs automatically on the backend every 5 min —
  //       no need to trigger it from the frontend at all.
  useEffect(() => {
    if (!authToken) return;
    const id = setInterval(() => {
      void fetchAdminData();
      void fetchStats();
      void fetchViewerCatalogCount();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const createChannel = async () => {
    if (!authToken) return;
    setError(null);
    if (!channelForm.name.trim()) return setFormError("Channel name is required.");
    if (!channelForm.country.trim()) return setFormError("Country is required.");
    if (!channelForm.category.trim()) return setFormError("Category is required.");
    if (!channelForm.language.trim()) return setFormError("Language is required.");
    if (!validateUrl(channelForm.stream_url, "Stream URL", true, ["http:", "https:", "rtmp:", "rtsp:", "udp:", "rtp:"])) return;
    if (!validateUrl(channelForm.logo_url, "Logo URL", false)) return;
    try {
      await apiClient.adminCreateChannel(authToken, {
        name: channelForm.name.trim(),
        country: channelForm.country.trim(),
        category: channelForm.category.trim(),
        language: channelForm.language.trim(),
        logo_url: channelForm.logo_url.trim() || null,
        stream_url: channelForm.stream_url.trim(),
        quality_tag: channelForm.quality_tag.trim(),
        module: channelForm.module,
        is_active: true,
      });
      setChannelForm(initialChannelForm);
      await fetchAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "চ্যানেল তৈরি ব্যর্থ");
    }
  };

  const deleteChannel = async (id: number) => {
    if (!authToken) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this channel permanently? / এই চ্যানেল স্থায়ীভাবে মুছে ফেলবেন?")) {
      return;
    }
    try {
      await apiClient.adminDeleteChannel(authToken, id);
      await fetchAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "চ্যানেল ডিলিট ব্যর্থ");
    }
  };

  const adminColumns = useMemo(
    () => [
      columnHelper.display({
        id: "probe",
        header: "Health",
        cell: (info) => {
          const st = aggregateProbeStatus(info.row.original, probeByUrl);
          if (st === "alive") {
            return (
              <span className="whitespace-nowrap text-lg" title="Active">
                🟢 <span className="sr-only">Active</span>
              </span>
            );
          }
          if (st === "geo_blocked") {
            return (
              <span className="whitespace-nowrap text-lg" title="Bypassed / proxied playback">
                🟡 <span className="sr-only">Bypassed or proxied</span>
              </span>
            );
          }
          if (st === "dead") {
            return (
              <span className="whitespace-nowrap text-lg" title="Dead / unreachable">
                🔴 <span className="sr-only">Dead</span>
              </span>
            );
          }
          return <span className="text-zinc-500">—</span>;
        },
      }),
      columnHelper.accessor("name", {
        header: "Channel",
        cell: (info) => <span className="font-medium text-white">{info.getValue()}</span>,
      }),
      columnHelper.accessor("module", { header: "Module" }),
      columnHelper.accessor("country", { header: "Country" }),
      columnHelper.accessor("stream_url", {
        header: "Stream URL",
        cell: (info) => (
          <span className="line-clamp-2 max-w-[14rem] break-all text-[11px] text-zinc-400 sm:max-w-xs">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <button
            type="button"
            onClick={() => void deleteChannel(info.row.original.id)}
            className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-2 text-rose-200 hover:bg-rose-500/20"
            title="Delete channel"
          >
            <Trash2 size={14} />
          </button>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deleteChannel closes over latest fetchAdminData
    [probeByUrl]
  );

  const adminTable = useReactTable({
    data: filteredAdminChannels,
    columns: adminColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const syncM3u = async () => {
    if (!authToken) return;
    setSyncing(true);
    setError(null);
    try {
      await apiClient.adminSyncChannels(authToken);
      await fetchAdminData();
      await fetchStats();
      await fetchViewerCatalogCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : "M3U Sync ব্যর্থ");
    } finally {
      setSyncing(false);
    }
  };

  if (!authToken || !user?.is_admin) {
    return (
      <main data-admin className="admin-shell flex min-h-dvh items-center justify-center p-6">
        <div className="admin-glass max-w-md rounded-2xl p-6 text-center">
          <p className="mb-4 text-zinc-200">অ্যাডমিন অ্যাক্সেস প্রয়োজন। আগে লগইন করুন।</p>
          <a
            href="/admin/login"
            className="inline-flex rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-emerald-900/30 transition hover:from-emerald-400 hover:to-emerald-500"
          >
            Admin Login
          </a>
        </div>
      </main>
    );
  }

  const adminDbInactive = stats
    ? Math.max(0, stats.channels - stats.active_channels)
    : 0;

  return (
    <main data-admin className="admin-shell">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <header className="sticky top-0 z-20 -mx-4 mb-2 border-b border-white/[0.06] bg-[#07080f]/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
              <Image src="/icons/original-logo.jpeg" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-white/10" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400/90">Admin</p>
                <h1 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl">Control center</h1>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {user?.email ? <span className="text-zinc-400">{user.email}</span> : null}
                  <span className="mx-2 text-zinc-600">·</span>
                  <span>Channels &amp; sync</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/10"
              >
                <Home size={16} className="opacity-80" />
                <span className="hidden sm:inline">Viewer</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  void fetchAdminData();
                  void fetchStats();
                  void fetchViewerCatalogCount();
                }}
                disabled={loading || refreshing}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading || refreshing ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => void syncM3u()}
                disabled={syncing}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-3.5 text-sm font-semibold text-black shadow-lg shadow-emerald-900/30 transition hover:from-emerald-400 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Activity size={16} />
                {syncing ? "Syncing…" : "M3U sync"}
              </button>
              <button
                type="button"
                onClick={clearSession}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 text-sm text-rose-100 transition hover:bg-rose-500/20"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {refreshing ? (
          <p className="text-center text-xs text-emerald-400/90">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
              তালিকা হালনাগাদ হচ্ছে…
            </span>
          </p>
        ) : null}

        {stats ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className="admin-stat rounded-2xl p-4 pl-4 pr-3 pt-5 ring-1 ring-white/10"
              style={{ "--c1": "#0ea5e9", "--c2": "#38bdf8" } as CSSProperties}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Users</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
                  <Users size={16} />
                </span>
              </div>
              <p className="mt-1 text-3xl font-bold tabular-nums text-white">{stats.users}</p>
            </div>
            <div
              className="admin-stat rounded-2xl p-4 pl-4 pr-3 pt-5 ring-1 ring-white/10"
              style={{ "--c1": "#8b5cf6", "--c2": "#a78bfa" } as CSSProperties}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Viewer catalog</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-200">
                  <Tv2 size={16} />
                </span>
              </div>
              <p className="mt-1 text-3xl font-bold tabular-nums text-white">
                {viewerCatalogTotal !== null ? viewerCatalogTotal : "—"}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                Viewer now uses active DB channels (+ live matches feed), so this count should align with Active rows below.
              </p>
            </div>
            <div
              className="admin-stat rounded-2xl p-4 pl-4 pr-3 pt-5 ring-1 ring-white/10"
              style={{ "--c1": "#f59e0b", "--c2": "#fbbf24" } as CSSProperties}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">DB catalog</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-200">
                  <Database size={16} />
                </span>
              </div>
              <p className="mt-1 text-3xl font-bold tabular-nums text-white">{stats.channels}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] tabular-nums text-zinc-400">
                <span title="Channels with is_active=true (shown on API / sync)">
                  <span className="text-emerald-400/90">●</span> Active{" "}
                  <span className="font-semibold text-zinc-200">{stats.active_channels}</span>
                </span>
                <span title="Total rows minus active">
                  <span className="text-zinc-500">○</span> Inactive{" "}
                  <span className="font-semibold text-zinc-300">{adminDbInactive}</span>
                </span>
              </div>
              <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">
                Matches the channel table below (M3U sync + manual). Large viewer count is normal — many streams are loaded only in the browser.
              </p>
            </div>
            <div
              className="admin-stat sm:col-span-2 lg:col-span-1 rounded-2xl p-4 pl-4 pr-3 pt-5 ring-1 ring-white/10"
              style={{ "--c1": "#64748b", "--c2": "#94a3b8" } as CSSProperties}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Cache &amp; job</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/15 text-slate-200">
                  <Clock size={16} />
                </span>
              </div>
              <p className="mt-1 text-sm leading-snug text-zinc-200">
                <span className="text-white">{stats.cache_ttl_seconds}s</span> cache
                <br />
                <span className="text-zinc-400">Sync every {stats.scheduled_sync_minutes || "off"}m</span>
                {stats.last_sync_at ? (
                  <>
                    <br />
                    <span className="text-[11px] text-zinc-500">{new Date(stats.last_sync_at).toLocaleString()}</span>
                  </>
                ) : null}
              </p>
            </div>
          </section>
        ) : null}

        {error && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
          >
            <p className="min-w-0 flex-1 leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 rounded-lg p-1.5 text-rose-200/80 transition hover:bg-rose-500/20"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="admin-glass rounded-2xl p-5"
        >
          <h2 className="mb-1 text-lg font-semibold text-white">নতুন চ্যানেল যোগ করুন</h2>
          <p className="mb-4 text-xs text-zinc-500">Required fields are validated before the backend call.</p>
          <div className="grid gap-3">
            {(Object.keys(channelForm) as Array<keyof ChannelFormState>).map((key) => {
              if (key === "module") {
                return (
                  <select
                    key={key}
                    value={channelForm.module}
                    onChange={(e) => setChannelForm((prev) => ({ ...prev, module: e.target.value }))}
                    className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                  >
                    <option value="global_sports">global_sports</option>
                    <option value="india">india</option>
                    <option value="bangladesh">bangladesh</option>
                  </select>
                );
              }
              if (key === "quality_tag") {
                return (
                  <select
                    key={key}
                    value={channelForm.quality_tag}
                    onChange={(e) => setChannelForm((prev) => ({ ...prev, quality_tag: e.target.value }))}
                    className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                  >
                    <option value="auto">auto</option>
                    <option value="HD">HD</option>
                    <option value="FHD">FHD</option>
                    <option value="4K">4K</option>
                    <option value="SD">SD</option>
                  </select>
                );
              }
              return (
                <input
                  key={key}
                  value={channelForm[key]}
                  onChange={(e) => setChannelForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                  placeholder={key}
                  type={key.includes("url") ? "url" : "text"}
                  required={key !== "logo_url"}
                />
              );
            })}
            <button
              type="button"
              onClick={() => void createChannel()}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
            >
              Add Channel
            </button>
          </div>
        </motion.div>
        </section>

        <section>
        <div className="admin-glass relative max-w-4xl rounded-2xl p-5">
          {refreshing && channels.length > 0 ? (
            <div
              className="pointer-events-none absolute inset-0 z-[1] rounded-2xl bg-[#07080f]/25 backdrop-blur-[1px]"
              aria-hidden
            />
          ) : null}
          <h2 className="mb-2 text-lg font-semibold text-white">চ্যানেল তালিকা</h2>
          <p className="mb-3 text-xs text-zinc-500">নাম, দেশ, ক্যাটাগরি, ভাষা বা স্ট্রিম URL দিয়ে খুঁজুন — মডিউল দিয়ে সরিয়ে দেখুন।</p>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                value={channelQuery}
                onChange={(e) => setChannelQuery(e.target.value)}
                placeholder="Search by name, country, category, URL…"
                className="w-full rounded-lg border border-white/20 bg-black/30 py-2 pl-8 pr-3 text-sm text-white outline-none focus:border-emerald-400"
                aria-label="Filter channel list"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter size={14} className="shrink-0 text-zinc-500" />
              <select
                value={channelModuleFilter}
                onChange={(e) => setChannelModuleFilter(e.target.value as "all" | "global_sports" | "india" | "bangladesh")}
                className="min-w-[8rem] rounded-lg border border-white/20 bg-black/30 px-2 py-2 text-sm text-white outline-none focus:border-emerald-400"
              >
                <option value="all">All modules</option>
                <option value="global_sports">global_sports</option>
                <option value="india">india</option>
                <option value="bangladesh">bangladesh</option>
              </select>
            </div>
          </div>
          {loading && channels.length === 0 ? (
            <p className="text-sm text-zinc-400">Loading…</p>
          ) : channels.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">No channels in the database yet. Add one using the form above, or run M3U sync.</p>
          ) : filteredAdminChannels.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">No channels match this search. Clear the filter or try different keywords.</p>
          ) : (
            <p className="mb-2 text-xs text-zinc-500">Showing {filteredAdminChannels.length} of {channels.length} channels</p>
          )}
          {channels.length > 0 && filteredAdminChannels.length > 0 && (
            <div className="max-h-[28rem] overflow-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-[1] bg-[#0c0e14]">
                  {adminTable.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="border-b border-white/10">
                      {hg.headers.map((h) => (
                        <th
                          key={h.id}
                          className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400"
                        >
                          {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {adminTable.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-white/[0.06] bg-black/20 transition hover:bg-white/[0.03]"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="align-top px-3 py-2.5 text-zinc-300">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </section>

        {/* ── Google AdSense Settings ── */}
        <AdminAdsenseSection />
      </div>
    </main>
  );
}

/* ─── Isolated sub-component so it can use its own state ─── */
function AdminAdsenseSection() {
  const settings = useSiteSettingsStore();
  const [form, setForm] = useState({
    adsensePublisherId: settings.adsensePublisherId,
    adsenseBannerSlot: settings.adsenseBannerSlot,
    adsenseInlineSlot: settings.adsenseInlineSlot,
    adsenseEnabled: settings.adsenseEnabled,
  });
  const [saved, setSaved] = useState(false);

  function handleSave() {
    settings.update(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="admin-glass rounded-2xl border border-amber-400/20 p-5 ring-1 ring-amber-500/10"
    >
      <div className="mb-4 flex items-center gap-2">
        <Megaphone size={18} className="text-amber-400" />
        <h2 className="text-lg font-semibold text-white">Google AdSense Settings</h2>
      </div>
      <p className="mb-4 text-xs text-zinc-400">
        আপনার Google AdSense Publisher ID এবং Slot IDs প্রদান করুন।
        AdSense অ্যাকাউন্ট থেকে <strong className="text-zinc-300">ca-pub-XXXXXXXXXX</strong> ফরম্যাটের ID পাবেন।
        Enabled করলে ব্যবহারকারীদের কাছে বিজ্ঞাপন দেখাবে (Premium ব্যবহারকারীরা ব্যতীত)।
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="col-span-full">
          <label className="mb-1 block text-xs font-semibold text-zinc-400">Publisher ID (ca-pub-XXXXXXXXXX)</label>
          <input
            value={form.adsensePublisherId}
            onChange={(e) => setForm((p) => ({ ...p, adsensePublisherId: e.target.value }))}
            placeholder="ca-pub-1234567890123456"
            className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-400">Banner Ad Slot ID (top bar)</label>
          <input
            value={form.adsenseBannerSlot}
            onChange={(e) => setForm((p) => ({ ...p, adsenseBannerSlot: e.target.value }))}
            placeholder="1234567890"
            className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-400">Inline Ad Slot ID (sidebar)</label>
          <input
            value={form.adsenseInlineSlot}
            onChange={(e) => setForm((p) => ({ ...p, adsenseInlineSlot: e.target.value }))}
            placeholder="0987654321"
            className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
          />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={form.adsenseEnabled}
            onChange={(e) => setForm((p) => ({ ...p, adsenseEnabled: e.target.checked }))}
            className="h-4 w-4 accent-amber-400"
          />
          <span className="text-sm text-zinc-300">AdSense Enable করুন</span>
        </label>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
        >
          <Settings2 size={15} />
          {saved ? "✓ Saved!" : "Save AdSense Settings"}
        </button>
      </div>
      <p className="mt-3 text-[10px] text-zinc-600">
        Note: AdSense script is loaded lazily. Changes take effect on next page load.
        Make sure your domain is approved in Google AdSense.
      </p>
    </motion.section>
  );
}
