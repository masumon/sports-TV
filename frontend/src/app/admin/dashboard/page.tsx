"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Edit2,
  Filter,
  Home,
  Info,
  LogOut,
  Megaphone,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Tv2,
  Users,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import { BRAND } from "@/lib/branding";
import type { AdminStats, Channel, StreamProbeItem, StreamProbeStatus } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";
import { useSiteSettingsStore } from "@/store/siteSettingsStore";

/* ─── Types ─────────────────────────────────────────────────────────── */

type ChannelFormState = {
  name: string;
  country: string;
  category: string;
  language: string;
  logo_url: string;
  stream_url: string;
  quality_tag: string;
  module: string;
  alternate_urls_text: string;
};

type EditFormState = ChannelFormState & { is_active: boolean };

/* ─── Helpers ───────────────────────────────────────────────────────── */

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

function ProbeStatusBadge({ status }: { status: StreamProbeStatus | "unknown" }) {
  if (status === "alive") return <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">🟢 Live</span>;
  if (status === "geo_blocked") return <span className="flex items-center gap-1 text-yellow-400 text-xs font-semibold">🟡 Geo</span>;
  if (status === "dead") return <span className="flex items-center gap-1 text-rose-400 text-xs font-semibold">🔴 Dead</span>;
  return <span className="text-zinc-600 text-xs">—</span>;
}

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-800 px-2.5 py-1.5 text-[11px] text-zinc-200 opacity-0 shadow-xl ring-1 ring-white/10 transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

const columnHelper = createColumnHelper<Channel>();

const MODULE_LABELS: Record<string, string> = {
  global_sports: "🌍 Global",
  bangladesh: "🇧🇩 BD",
  india: "🇮🇳 India",
  fast_tv: "⚡ FAST",
  live_matches: "🔴 Live",
  world_cup_2026: "🏆 WC26",
};

const initialChannelForm: ChannelFormState = {
  name: "",
  country: "Global",
  category: "Sports",
  language: "Unknown",
  logo_url: "",
  stream_url: "",
  quality_tag: "auto",
  module: "global_sports",
  alternate_urls_text: "",
};

/* ─── Edit Modal ────────────────────────────────────────────────────── */

function EditChannelModal({
  channel,
  onClose,
  onSave,
  authToken,
}: {
  channel: Channel;
  onClose: () => void;
  onSave: () => void;
  authToken: string;
}) {
  const [form, setForm] = useState<EditFormState>({
    name: channel.name,
    country: channel.country,
    category: channel.category,
    language: channel.language,
    logo_url: channel.logo_url || "",
    stream_url: channel.stream_url,
    quality_tag: channel.quality_tag,
    module: channel.module,
    alternate_urls_text: (channel.alternate_urls || []).join("\n"),
    is_active: channel.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [probeStatus, setProbeStatus] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);

  const probeUrl = async (url: string) => {
    if (!url.trim()) return;
    setProbing(true);
    setProbeStatus(null);
    try {
      const res = await apiClient.adminProbeStreams(authToken, [url.trim()]);
      setProbeStatus(res.results[0]?.status ?? "unknown");
    } catch {
      setProbeStatus("error");
    } finally {
      setProbing(false);
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.stream_url.trim()) {
      toast.error("Name and Stream URL are required");
      return;
    }
    setSaving(true);
    try {
      await apiClient.adminUpdateChannel(authToken, channel.id, {
        name: form.name.trim(),
        country: form.country.trim(),
        category: form.category.trim(),
        language: form.language.trim(),
        logo_url: form.logo_url.trim() || null,
        stream_url: form.stream_url.trim(),
        quality_tag: form.quality_tag,
        module: form.module,
        is_active: form.is_active,
        alternate_urls: form.alternate_urls_text
          .split("\n")
          .map((u) => u.trim())
          .filter(Boolean),
      });
      toast.success(`✓ "${form.name}" updated`);
      onSave();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const probeColor =
    probeStatus === "alive" ? "text-emerald-400" :
    probeStatus === "geo_blocked" ? "text-yellow-400" :
    probeStatus === "dead" ? "text-rose-400" : "text-zinc-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18 }}
        className="relative z-10 w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0c0e14] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Edit Channel</h2>
            <p className="text-xs text-zinc-500">ID: {channel.id} · Source: {channel.source || "manual"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Basic Info</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Channel Name *</label>
                <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Module</label>
                <select value={form.module} onChange={(e) => setForm(p => ({ ...p, module: e.target.value }))}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400">
                  <option value="global_sports">🌍 Global Sports</option>
                  <option value="bangladesh">🇧🇩 Bangladesh</option>
                  <option value="india">🇮🇳 India</option>
                  <option value="fast_tv">⚡ FAST TV</option>
                  <option value="world_cup_2026">🏆 World Cup 2026</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={form.is_active}
                  onChange={(e) => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  className="h-4 w-4 accent-emerald-400" />
                <span className="text-sm text-zinc-300">Active (visible to viewers)</span>
              </label>
            </div>
          </div>

          {/* Stream Source */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Stream Source</p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-400">Primary Stream URL *</label>
              <div className="flex gap-2">
                <input value={form.stream_url} onChange={(e) => setForm(p => ({ ...p, stream_url: e.target.value }))}
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                  placeholder="https://..." type="url" />
                <button type="button" onClick={() => void probeUrl(form.stream_url)} disabled={probing || !form.stream_url.trim()}
                  title="Test stream URL reachability"
                  className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 disabled:opacity-50">
                  {probing ? <RefreshCw size={13} className="animate-spin" /> : "Test"}
                </button>
              </div>
              {probeStatus && (
                <p className={`mt-1 text-[11px] font-semibold ${probeColor}`}>
                  {probeStatus === "alive" ? "🟢 Stream is live" :
                   probeStatus === "geo_blocked" ? "🟡 Geo-restricted (may need proxy)" :
                   probeStatus === "dead" ? "🔴 Stream is unreachable" :
                   "⚪ Could not determine status"}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-400">
                Alternate / Fallback URLs
                <span className="ml-1 font-normal text-zinc-600">(one per line — used when primary fails)</span>
              </label>
              <textarea value={form.alternate_urls_text}
                onChange={(e) => setForm(p => ({ ...p, alternate_urls_text: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400 resize-y"
                placeholder={"https://backup1.example.com/stream.m3u8\nhttps://backup2.example.com/stream.m3u8"} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Quality</label>
                <select value={form.quality_tag} onChange={(e) => setForm(p => ({ ...p, quality_tag: e.target.value }))}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400">
                  <option value="auto">auto</option>
                  <option value="HD">HD</option>
                  <option value="FHD">FHD</option>
                  <option value="4K">4K</option>
                  <option value="SD">SD</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Logo URL</label>
                <input value={form.logo_url} onChange={(e) => setForm(p => ({ ...p, logo_url: e.target.value }))}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                  placeholder="https://..." type="url" />
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Metadata</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Country</label>
                <input value={form.country} onChange={(e) => setForm(p => ({ ...p, country: e.target.value }))}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Category</label>
                <input value={form.category} onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Language</label>
                <input value={form.language} onChange={(e) => setForm(p => ({ ...p, language: e.target.value }))}
                  className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5">
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */

export default function AdminDashboardPage() {
  const { token, user, clearSession } = useAuthStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const initialFetchDone = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingFixtures, setSyncingFixtures] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<{ checked: number; deactivated: number; duration_seconds: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [channelQuery, setChannelQuery] = useState("");
  const [channelModuleFilter, setChannelModuleFilter] = useState<string>("all");
  const [channelStatusFilter, setChannelStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [channelListTotal, setChannelListTotal] = useState(0);
  const [probeByUrl, setProbeByUrl] = useState<Record<string, StreamProbeItem>>({});
  const [editChannel, setEditChannel] = useState<Channel | null>(null);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [addProbeStatus, setAddProbeStatus] = useState<string | null>(null);
  const [addProbing, setAddProbing] = useState(false);

  // Add channel form
  const [channelForm, setChannelForm] = useState<ChannelFormState>(initialChannelForm);

  // Bulk operations
  const [selectedChannels, setSelectedChannels] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const authToken = token;

  const toggleChannelSelection = (id: number) => {
    const newSet = new Set(selectedChannels);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedChannels(newSet);
  };

  const selectAll = (select: boolean) => {
    if (select) {
      setSelectedChannels(new Set(filteredAdminChannels.map((c) => c.id)));
    } else {
      setSelectedChannels(new Set());
    }
  };

  const bulkDelete = async () => {
    if (!authToken) {
      toast.error("Not authenticated");
      return;
    }
    if (selectedChannels.size === 0) {
      toast.error("No channels selected");
      return;
    }
    if (!confirm(`Delete ${selectedChannels.size} channels? This cannot be undone.`)) return;

    setBulkActionLoading(true);
    try {
      const res = await apiClient.adminBulkDelete(authToken, Array.from(selectedChannels));
      toast.success(`✓ Deleted ${(res as { deleted: number }).deleted} channels`);
      setSelectedChannels(new Set());
      await fetchAdminData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const bulkToggleStatus = async (isActive: boolean) => {
    if (!authToken) {
      toast.error("Not authenticated");
      return;
    }
    if (selectedChannels.size === 0) {
      toast.error("No channels selected");
      return;
    }

    setBulkActionLoading(true);
    try {
      const res = await apiClient.adminBulkUpdateStatus(authToken, Array.from(selectedChannels), isActive);
      toast.success(`✓ Updated ${res.updated} channels to ${isActive ? "active" : "inactive"}`);
      setSelectedChannels(new Set());
      await fetchAdminData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk update failed");
    } finally {
      setBulkActionLoading(false);
    }
  };

  /* ─── Derived ─────────────────────────────────────────────────── */

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

  const moduleCounts = useMemo(() => {
    if (stats?.active_module_counts && Object.keys(stats.active_module_counts).length > 0) {
      return stats.active_module_counts;
    }
    const counts: Record<string, number> = {};
    for (const ch of channels) {
      if (!ch.is_active) continue;
      counts[ch.module] = (counts[ch.module] || 0) + 1;
    }
    return counts;
  }, [stats?.active_module_counts, channels]);

  const expectedChannelTotal = useMemo(() => {
    if (!stats) return channelListTotal;
    if (channelStatusFilter === "active") return stats.active_channels;
    if (channelStatusFilter === "inactive") return stats.inactive_channels;
    return stats.channels;
  }, [stats, channelStatusFilter, channelListTotal]);

  /* ─── Effects ─────────────────────────────────────────────────── */

  // Auto-dismiss error
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(t);
  }, [error]);

  // Session timeout warning (token TTL 24h; warn at 23h 50min)
  useEffect(() => {
    if (!authToken) return;
    const timer = setTimeout(() => setSessionWarning(true), (24 * 60 - 10) * 60 * 1000);
    return () => clearTimeout(timer);
  }, [authToken]);

  // Probe all channel URLs
  useEffect(() => {
    if (!authToken || channels.length === 0) { setProbeByUrl({}); return; }
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
      try {
        for (let i = 0; i < list.length; i += 50) {
          const slice = list.slice(i, i + 50);
          const res = await apiClient.adminProbeStreams(authToken, slice);
          if (cancelled) return;
          for (const r of res.results) map[normProbeKey(r.url)] = r;
        }
        if (!cancelled) setProbeByUrl(map);
      } catch {
        if (!cancelled) setProbeByUrl({});
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [authToken, channels]);

  /* ─── Data fetching ───────────────────────────────────────────── */

  const fetchAdminData = async () => {
    if (!authToken) return;
    if (!initialFetchDone.current) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const { items, total } = await apiClient.adminListChannels(authToken, channelStatusFilter);
      setChannels(items);
      setChannelListTotal(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড করা যায়নি");
    } finally {
      setLoading(false);
      setRefreshing(false);
      initialFetchDone.current = true;
    }
  };

  const fetchStats = async () => {
    if (!authToken) return;
    try {
      const s = await apiClient.adminStats(authToken);
      setStats(s);
    } catch (err) {
      // Log error but don't block — stats are optional
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn("[Admin] fetchStats failed:", errMsg);
      if (errMsg.includes("timeout")) {
        console.warn("[Admin] Stats request timed out — backend may be slow");
      }
    }
  };

  useEffect(() => {
    if (!authToken) return;
    void fetchAdminData();
    void fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, channelStatusFilter]);

  useEffect(() => {
    if (!authToken) return;
    const id = setInterval(() => { void fetchAdminData(); void fetchStats(); }, 5 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, channelStatusFilter]);

  /* ─── Actions ─────────────────────────────────────────────────── */

  const syncM3u = async () => {
    if (!authToken) return;
    setSyncing(true);
    const fallback = setTimeout(() => setSyncing(false), 6 * 60 * 1000);
    try {
      const result = await apiClient.adminSyncChannels(authToken);
      await fetchAdminData();
      await fetchStats();
      const created = result?.created ?? 0;
      const updated = result?.updated ?? 0;
      const total = result?.total ?? 0;
      const parsed = result?.parsed ?? total;
      toast.success(`✓ Sync সম্পন্ন — ${created} নতুন, ${updated} আপডেট, ${parsed} parsed, ${total} মোট`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "M3U Sync ব্যর্থ হয়েছে";
      setError(msg);
      toast.error(msg);
    } finally {
      clearTimeout(fallback);
      setSyncing(false);
    }
  };

  const syncFixtures = async () => {
    if (!authToken) return;
    setSyncingFixtures(true);
    const fallback = setTimeout(() => setSyncingFixtures(false), 3 * 60 * 1000);
    try {
      const res = await apiClient.adminSyncFixtures(authToken);
      const touched = Object.values(res).reduce((a, b) => a + (b as number), 0);
      await fetchStats();
      toast.success(`✓ Fixture sync সম্পন্ন — ${touched} matches আপডেট`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fixture sync ব্যর্থ হয়েছে");
    } finally {
      clearTimeout(fallback);
      setSyncingFixtures(false);
    }
  };

  const runHealthSweep = async () => {
    if (!authToken) return;
    if (!window.confirm("এই অপারেশন সব active channel চেক করবে এবং dead link গুলো inactive করবে। চালাবেন?")) return;
    setSweeping(true);
    setSweepResult(null);
    const fallback = setTimeout(() => setSweeping(false), 11 * 60 * 1000);
    try {
      const res = await apiClient.adminHealthSweep(authToken);
      setSweepResult(res);
      await fetchAdminData();
      await fetchStats();
      toast.success(`✓ Sweep সম্পন্ন — ${res.checked} checked, ${res.deactivated} dead link inactive`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Health sweep ব্যর্থ হয়েছে");
    } finally {
      clearTimeout(fallback);
      setSweeping(false);
    }
  };

  const createChannel = async () => {
    if (!authToken) return;
    if (!channelForm.name.trim()) { toast.error("Channel name is required"); return; }
    if (!channelForm.stream_url.trim()) { toast.error("Stream URL is required"); return; }
    try {
      new URL(channelForm.stream_url.trim());
    } catch {
      toast.error("Invalid stream URL"); return;
    }
    try {
      await apiClient.adminCreateChannel(authToken, {
        name: channelForm.name.trim(),
        country: channelForm.country.trim() || "Global",
        category: channelForm.category.trim() || "Sports",
        language: channelForm.language.trim() || "Unknown",
        logo_url: channelForm.logo_url.trim() || null,
        stream_url: channelForm.stream_url.trim(),
        quality_tag: channelForm.quality_tag,
        module: channelForm.module,
        is_active: true,
        alternate_urls: channelForm.alternate_urls_text.split("\n").map(u => u.trim()).filter(Boolean),
      });
      toast.success(`✓ "${channelForm.name}" যোগ হয়েছে`);
      setChannelForm(initialChannelForm);
      setAddProbeStatus(null);
      setShowAdvanced(false);
      await fetchAdminData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "চ্যানেল তৈরি ব্যর্থ");
    }
  };

  const deleteChannel = async (id: number, name: string) => {
    if (!authToken) return;
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await apiClient.adminDeleteChannel(authToken, id);
      setChannels(prev => prev.filter(c => c.id !== id));
      toast.success(`✓ "${name}" inactive`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const probeAddUrl = async () => {
    if (!authToken || !channelForm.stream_url.trim()) return;
    setAddProbing(true);
    setAddProbeStatus(null);
    try {
      const res = await apiClient.adminProbeStreams(authToken, [channelForm.stream_url.trim()]);
      setAddProbeStatus(res.results[0]?.status ?? "unknown");
    } catch {
      setAddProbeStatus("error");
    } finally {
      setAddProbing(false);
    }
  };

  /* ─── Table columns ───────────────────────────────────────────── */

  const adminColumns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: "",
        cell: (info) => (
          <input
            type="checkbox"
            checked={selectedChannels.has(info.row.original.id)}
            onChange={() => toggleChannelSelection(info.row.original.id)}
            title="Select channel for bulk operations"
            className="rounded border border-blue-400 cursor-pointer"
          />
        ),
      }),
      columnHelper.display({
        id: "probe",
        header: "Health",
        cell: (info) => <ProbeStatusBadge status={aggregateProbeStatus(info.row.original, probeByUrl)} />,
      }),
      columnHelper.accessor("name", {
        header: "Channel",
        cell: (info) => (
          <div className="flex flex-col gap-0.5">
            <span className={`font-semibold leading-tight ${info.row.original.is_active ? "text-white" : "text-zinc-400"}`}>
              {info.getValue()}
              {!info.row.original.is_active ? (
                <span className="ml-1.5 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-300 bg-rose-500/15">
                  inactive
                </span>
              ) : null}
            </span>
            <span className="text-[10px] text-zinc-500">{info.row.original.country}</span>
          </div>
        ),
      }),
      columnHelper.accessor("module", {
        header: "Module",
        cell: (info) => (
          <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "#a1a1aa" }}>
            {MODULE_LABELS[info.getValue()] ?? info.getValue()}
          </span>
        ),
      }),
      columnHelper.display({
        id: "source",
        header: "Source",
        cell: (info) => {
          const src = info.row.original.source || "manual";
          return (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${src === "manual" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>
              {src === "manual" ? "✏ Manual" : `⟳ ${src}`}
            </span>
          );
        },
      }),
      columnHelper.accessor("stream_url", {
        header: "Stream URL",
        cell: (info) => (
          <span className="line-clamp-1 max-w-[12rem] text-[11px] text-zinc-500" title={info.getValue()}>
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => {
          const ch = info.row.original;
          return (
            <div className="flex items-center gap-1.5">
              {/* Edit */}
              <button type="button" onClick={() => setEditChannel(ch)}
                title="Edit channel"
                className="rounded-lg bg-blue-500/10 p-1.5 text-blue-400 transition hover:bg-blue-500/20">
                <Edit2 size={14} />
              </button>
              {/* Delete */}
              <button type="button" onClick={() => void deleteChannel(ch.id, ch.name)}
                title="Delete channel"
                className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-1.5 text-rose-400 transition hover:bg-rose-500/20">
                <Trash2 size={14} />
              </button>
            </div>
          );
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [probeByUrl, channels]
  );

  const adminTable = useReactTable({
    data: filteredAdminChannels,
    columns: adminColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  /* ─── Guard ───────────────────────────────────────────────────── */

  if (!authToken || !user?.is_admin) {
    return (
      <main data-admin className="admin-shell flex min-h-dvh items-center justify-center p-6">
        <div className="admin-glass max-w-md rounded-2xl p-6 text-center">
          <p className="mb-4 text-zinc-200">অ্যাডমিন অ্যাক্সেস প্রয়োজন। আগে লগইন করুন।</p>
          <a href="/admin/login"
            className="inline-flex rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-emerald-900/30 transition hover:from-emerald-400 hover:to-emerald-500">
            Admin Login
          </a>
        </div>
      </main>
    );
  }

  /* ─── Render ──────────────────────────────────────────────────── */

  return (
    <main data-admin className="admin-shell">
      {/* Edit Modal */}
      <AnimatePresence>
        {editChannel && (
          <EditChannelModal
            channel={editChannel}
            authToken={authToken}
            onClose={() => setEditChannel(null)}
            onSave={() => void fetchAdminData()}
          />
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">

        {/* ── Sticky Header ── */}
        <header className="sticky top-0 z-20 -mx-4 mb-2 border-b border-white/[0.06] bg-[#07080f]/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Image src={BRAND.logo.png} alt={BRAND.name} width={40} height={40}
                className="h-10 w-10 shrink-0 rounded-full object-contain" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400/90">Admin</p>
                <h1 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl">Control center</h1>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {user?.email && <span className="text-zinc-400">{user.email}</span>}
                  <span className="mx-2 text-zinc-600">·</span>
                  <span>Channels &amp; sync</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Link href="/"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/10">
                <Home size={16} className="opacity-80" /><span className="hidden sm:inline">Viewer</span>
              </Link>
              <button type="button" onClick={() => { void fetchAdminData(); void fetchStats(); }}
                disabled={loading || refreshing}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white transition hover:bg-white/10 disabled:opacity-50">
                <RefreshCw size={16} className={loading || refreshing ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <Tooltip text="M3U playlist থেকে channels sync করবে। Background-এ চলে — page reload লাগবে না।">
                <button type="button" onClick={() => void syncM3u()} disabled={syncing}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-3.5 text-sm font-semibold text-black shadow-lg shadow-emerald-900/30 transition hover:from-emerald-400 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">
                  <Activity size={16} />{syncing ? "Syncing…" : "M3U Sync"}
                </button>
              </Tooltip>
              <Tooltip text="OpenLigaDB + football-data.org + CricAPI থেকে fixtures sync করবে। FOOTBALL_DATA_ORG_API_TOKEN ও/অথবা CRICAPI_KEY দরকার।">
                <button type="button" onClick={() => void syncFixtures()} disabled={syncingFixtures}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:from-blue-400 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
                  <Calendar size={16} />{syncingFixtures ? "Syncing…" : "Sync Fixtures"}
                </button>
              </Tooltip>
              <Tooltip text="সব active channel চেক করে dead link inactive করবে। Heavy operation — কয়েক মিনিট লাগতে পারে।">
                <button type="button" onClick={() => void runHealthSweep()} disabled={sweeping}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 px-3.5 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 transition hover:from-rose-500 hover:to-rose-600 disabled:cursor-not-allowed disabled:opacity-60">
                  <Zap size={16} className={sweeping ? "animate-pulse" : ""} />
                  {sweeping ? "Sweeping…" : "Dead Sweep"}
                </button>
              </Tooltip>
              <button type="button" onClick={clearSession}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 text-sm text-rose-100 transition hover:bg-rose-500/20">
                <LogOut size={16} /><span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── Session timeout warning ── */}
        {sessionWarning && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
            <div className="flex items-center gap-2 text-amber-200">
              <Clock size={16} className="shrink-0" />
              <p className="text-sm font-medium">আপনার session শীঘ্রই শেষ হবে। Data হারানো এড়াতে save করুন এবং পুনরায় login করুন।</p>
            </div>
            <button type="button" onClick={() => setSessionWarning(false)} className="shrink-0 rounded p-1 hover:bg-amber-500/20">
              <X size={14} className="text-amber-300" />
            </button>
          </div>
        )}

        {/* ── Refreshing indicator ── */}
        {refreshing && (
          <p className="text-center text-xs text-emerald-400/90">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
              তালিকা হালনাগাদ হচ্ছে…
            </span>
          </p>
        )}

        {/* ── Stats cards ── */}
        {stats && (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Users */}
            <div className="admin-stat rounded-2xl p-4 pt-5 ring-1 ring-white/10" style={{ "--c1": "#0ea5e9", "--c2": "#38bdf8" } as CSSProperties}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Users</p>
                  <Tooltip text="Total registered accounts (admin + viewers). PRUNE_NON_DEFAULT_USERS_ON_STARTUP=true হলে প্রতি restart-এ admin ছাড়া বাকিরা মুছে যায়।">
                    <Info size={11} className="text-zinc-600 cursor-help" />
                  </Tooltip>
                </div>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300"><Users size={16} /></span>
              </div>
              <p className="mt-1 text-3xl font-bold tabular-nums text-white">{stats.users}</p>
            </div>

            {/* Viewer catalog */}
            <div className="admin-stat rounded-2xl p-4 pt-5 ring-1 ring-white/10" style={{ "--c1": "#8b5cf6", "--c2": "#a78bfa" } as CSSProperties}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Active Channels</p>
                  <Tooltip text="DB-তে is_active=true channels। Viewer আরও বেশি দেখে কারণ M3U catalog browser-এ load হয়।">
                    <Info size={11} className="text-zinc-600 cursor-help" />
                  </Tooltip>
                </div>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-200"><Tv2 size={16} /></span>
              </div>
              <p className="mt-1 text-3xl font-bold tabular-nums text-white">{stats.active_channels.toLocaleString()}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] tabular-nums text-zinc-400">
                <span><span className="text-emerald-400">●</span> Active <span className="font-semibold text-zinc-200">{stats.active_channels.toLocaleString()}</span></span>
                {(stats.inactive_channels ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="text-red-400">●</span> Inactive <span className="font-semibold text-red-300">{(stats.inactive_channels ?? 0).toLocaleString()}</span>
                    <button type="button" onClick={() => setChannelStatusFilter("inactive")}
                      className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition">
                      View
                    </button>
                  </span>
                )}
              </div>
            </div>

            {/* DB Total */}
            <div className="admin-stat rounded-2xl p-4 pt-5 ring-1 ring-white/10" style={{ "--c1": "#10b981", "--c2": "#34d399" } as CSSProperties}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">DB Total</p>
                  <Tooltip text="Database-এর সব channel (active + inactive)। M3U sync-এর পর বাড়ে।">
                    <Info size={11} className="text-zinc-600 cursor-help" />
                  </Tooltip>
                </div>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300"><Database size={16} /></span>
              </div>
              <p className="mt-1 text-3xl font-bold tabular-nums text-white">{stats.channels.toLocaleString()}</p>
              {/* Module breakdown */}
              {Object.keys(moduleCounts).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="mr-1 text-[9px] text-zinc-600">Active:</span>
                  {Object.entries(moduleCounts).sort((a,b) => b[1]-a[1]).slice(0,4).map(([mod, cnt]) => (
                    <span key={mod} className="rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: "rgba(255,255,255,0.06)", color: "#a1a1aa" }}>
                      {MODULE_LABELS[mod] ?? mod} {cnt}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Cache & Sync */}
            <div className="admin-stat rounded-2xl p-4 pt-5 ring-1 ring-white/10" style={{ "--c1": "#64748b", "--c2": "#94a3b8" } as CSSProperties}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Cache &amp; Job</p>
                  <Tooltip text="Redis cache TTL এবং scheduled M3U sync interval। 0 মানে disabled।">
                    <Info size={11} className="text-zinc-600 cursor-help" />
                  </Tooltip>
                </div>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/15 text-slate-200"><Clock size={16} /></span>
              </div>
              <p className="mt-1 text-sm leading-snug text-zinc-200">
                <span className="text-white font-semibold">{stats.cache_ttl_seconds}s</span> cache
                <br />
                <span className="text-zinc-400">Sync every {stats.scheduled_sync_minutes || "—"}m</span>
                {stats.last_sync_at && (
                  <><br /><span className="text-[10px] text-zinc-500">{new Date(stats.last_sync_at).toLocaleString()}</span></>
                )}
                {stats.last_sync_status && (
                  <><br /><span className={`text-[11px] font-semibold ${stats.last_sync_status === "success" ? "text-emerald-400" : stats.last_sync_status === "failed" ? "text-rose-400" : "text-amber-400"}`}>
                    {stats.last_sync_status === "success" ? "✓ Sync OK" : stats.last_sync_status === "failed" ? "✗ Sync failed" : "⟳ Syncing…"}
                  </span></>
                )}
                {(stats.last_sync_created ?? 0) > 0 || (stats.last_sync_updated ?? 0) > 0 ? (
                  <><br /><span className="text-[10px] text-zinc-500">
                    Last sync: +{stats.last_sync_created ?? 0} new, {stats.last_sync_updated ?? 0} updated
                  </span></>
                ) : null}
                {stats.last_sync_error && (
                  <><br /><span className="text-[10px] text-rose-300/80" title={stats.last_sync_error}>
                    {stats.last_sync_error.length > 70 ? stats.last_sync_error.slice(0, 70) + "…" : stats.last_sync_error}
                  </span></>
                )}
                {(stats.last_sweep_at || stats.last_sweep_checked > 0) && (
                  <>
                    <br />
                    <span className="text-[10px] text-zinc-500">
                      🧹 Sweep: {stats.last_sweep_checked} checked, {" "}
                      <span className={stats.last_sweep_deactivated > 0 ? "text-rose-400" : "text-emerald-400"}>
                        {stats.last_sweep_deactivated} removed
                      </span>
                    </span>
                  </>
                )}
              </p>
            </div>
          </section>
        )}

        {/* ── Sweep result banner ── */}
        {sweepResult && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Zap size={16} className="shrink-0 text-rose-400" />
              <div>
                <p className="text-sm font-semibold text-rose-100">Dead Link Sweep সম্পন্ন</p>
                <p className="text-xs text-zinc-400">
                  <span className="text-zinc-200 font-semibold">{sweepResult.checked}</span> channels checked ·{" "}
                  <span className={sweepResult.deactivated > 0 ? "text-rose-300 font-semibold" : "text-emerald-400 font-semibold"}>
                    {sweepResult.deactivated} dead link{sweepResult.deactivated !== 1 ? "s" : ""} inactive
                  </span>
                  {sweepResult.duration_seconds != null && (
                    <> · {sweepResult.duration_seconds}s</>
                  )}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setSweepResult(null)} className="shrink-0 rounded p-1 hover:bg-rose-500/20">
              <X size={14} className="text-rose-300" />
            </button>
          </div>
        )}

        {/* ── Error banner ── */}
        {error && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            <p className="min-w-0 flex-1 leading-relaxed">{error}</p>
            <button type="button" onClick={() => setError(null)} className="shrink-0 rounded-lg p-1.5 text-rose-200/80 transition hover:bg-rose-500/20" aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}

        {/* ── Add Channel Form ── */}
        <section className="max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="admin-glass rounded-2xl p-5">
            <h2 className="mb-1 text-lg font-semibold text-white">নতুন চ্যানেল যোগ করুন</h2>
            <p className="mb-4 text-xs text-zinc-500">Basic info + stream URL দিয়ে channel যোগ করুন। Advanced settings optional।</p>

            {/* Basic Fields */}
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-400">Channel Name *</label>
                  <input value={channelForm.name} onChange={(e) => setChannelForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400" placeholder="e.g. ESPN HD" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-400">Module</label>
                  <select value={channelForm.module} onChange={(e) => setChannelForm(p => ({ ...p, module: e.target.value }))}
                    className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400">
                    <option value="global_sports">🌍 Global Sports</option>
                    <option value="bangladesh">🇧🇩 Bangladesh</option>
                    <option value="india">🇮🇳 India</option>
                    <option value="fast_tv">⚡ FAST TV</option>
                    <option value="world_cup_2026">🏆 World Cup 2026</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">Stream URL *</label>
                <div className="flex gap-2">
                  <input value={channelForm.stream_url} onChange={(e) => { setChannelForm(p => ({ ...p, stream_url: e.target.value })); setAddProbeStatus(null); }}
                    className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                    placeholder="https://example.com/stream.m3u8" type="url" />
                  <button type="button" onClick={() => void probeAddUrl()} disabled={addProbing || !channelForm.stream_url.trim()}
                    title="Test URL before adding"
                    className="shrink-0 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10 disabled:opacity-50">
                    {addProbing ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
                  </button>
                </div>
                {addProbeStatus && (
                  <p className={`mt-1 text-[11px] font-semibold ${addProbeStatus === "alive" ? "text-emerald-400" : addProbeStatus === "geo_blocked" ? "text-yellow-400" : "text-rose-400"}`}>
                    {addProbeStatus === "alive" ? "🟢 Stream is live" : addProbeStatus === "geo_blocked" ? "🟡 Geo-restricted" : "🔴 Stream unreachable"}
                  </p>
                )}
              </div>

              {/* Advanced toggle */}
              <button type="button" onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition hover:text-zinc-200">
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Advanced (country, quality, logo, fallback URLs…)
              </button>

              {showAdvanced && (
                <div className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-400">Country</label>
                      <input value={channelForm.country} onChange={(e) => setChannelForm(p => ({ ...p, country: e.target.value }))}
                        className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400" placeholder="Global" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-400">Category</label>
                      <input value={channelForm.category} onChange={(e) => setChannelForm(p => ({ ...p, category: e.target.value }))}
                        className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400" placeholder="Sports" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-400">Language</label>
                      <input value={channelForm.language} onChange={(e) => setChannelForm(p => ({ ...p, language: e.target.value }))}
                        className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400" placeholder="Unknown" />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-400">Quality</label>
                      <select value={channelForm.quality_tag} onChange={(e) => setChannelForm(p => ({ ...p, quality_tag: e.target.value }))}
                        className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400">
                        <option value="auto">auto</option>
                        <option value="HD">HD</option>
                        <option value="FHD">FHD</option>
                        <option value="4K">4K</option>
                        <option value="SD">SD</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-zinc-400">Logo URL</label>
                      <input value={channelForm.logo_url} onChange={(e) => setChannelForm(p => ({ ...p, logo_url: e.target.value }))}
                        className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400" placeholder="https://..." type="url" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-400">
                      Alternate / Fallback URLs
                      <span className="ml-1 font-normal text-zinc-600">(one per line)</span>
                    </label>
                    <textarea value={channelForm.alternate_urls_text} onChange={(e) => setChannelForm(p => ({ ...p, alternate_urls_text: e.target.value }))}
                      rows={2} className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400 resize-y"
                      placeholder={"https://backup1.m3u8\nhttps://backup2.m3u8"} />
                  </div>
                </div>
              )}

              <button type="button" onClick={() => void createChannel()}
                className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 sm:w-auto sm:px-6">
                + Add Channel
              </button>
            </div>
          </motion.div>
        </section>

        {/* ── Channel List ── */}
        <section>
          <div className="admin-glass relative max-w-6xl rounded-2xl p-5">
            {refreshing && channels.length > 0 && (
              <div className="pointer-events-none absolute inset-0 z-[1] rounded-2xl bg-[#07080f]/25 backdrop-blur-[1px]" aria-hidden />
            )}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">চ্যানেল তালিকা</h2>
                <p className="text-xs text-zinc-500">Edit ✏ / Activate ▶ / Delete 🗑 — নাম বা URL দিয়ে খুঁজুন</p>
              </div>
              {channels.length > 0 && (
                <span className="text-xs text-zinc-500">
                  {filteredAdminChannels.length} / {channels.length} shown
                  {expectedChannelTotal > 0 ? ` · DB ${expectedChannelTotal.toLocaleString()}` : ""}
                  {channelModuleFilter !== "all" ? ` in ${MODULE_LABELS[channelModuleFilter] ?? channelModuleFilter}` : ""}
                </span>
              )}
            </div>

            {/* Search + Filter row */}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input value={channelQuery} onChange={(e) => setChannelQuery(e.target.value)}
                  placeholder="নাম, দেশ, URL দিয়ে খুঁজুন…"
                  className="w-full rounded-lg border border-white/20 bg-black/30 py-2 pl-8 pr-8 text-sm text-white outline-none focus:border-emerald-400" />
                {channelQuery && (
                  <button type="button" onClick={() => setChannelQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-500 hover:text-zinc-300">
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Filter size={14} className="shrink-0 text-zinc-500" />
                <select value={channelStatusFilter} onChange={(e) => setChannelStatusFilter(e.target.value as "active" | "inactive" | "all")}
                  className="min-w-[7.5rem] rounded-lg border border-white/20 bg-black/30 px-2 py-2 text-sm text-white outline-none focus:border-emerald-400">
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                  <option value="all">All channels</option>
                </select>
                <select value={channelModuleFilter} onChange={(e) => setChannelModuleFilter(e.target.value)}
                  className="min-w-[9rem] rounded-lg border border-white/20 bg-black/30 px-2 py-2 text-sm text-white outline-none focus:border-emerald-400">
                  <option value="all">All modules</option>
                  <option value="global_sports">🌍 Global Sports</option>
                  <option value="bangladesh">🇧🇩 Bangladesh</option>
                  <option value="india">🇮🇳 India</option>
                  <option value="fast_tv">⚡ FAST TV</option>
                  <option value="world_cup_2026">🏆 World Cup 2026</option>
                </select>
              </div>
            </div>

            {expectedChannelTotal > 0 && channels.length > 0 && channels.length < expectedChannelTotal && (
              <div className="mb-3 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Loaded {channels.length.toLocaleString()} of {expectedChannelTotal.toLocaleString()} channels (API total {channelListTotal.toLocaleString()}) —{" "}
                <button type="button" onClick={() => void fetchAdminData()} className="font-semibold underline hover:text-white">
                  Reload list
                </button>
              </div>
            )}

            {/* Bulk Actions */}
            {channels.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-400/25 bg-blue-500/10 px-3 py-2.5">
                <label className="flex items-center gap-2 text-xs text-blue-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedChannels.size === filteredAdminChannels.length && filteredAdminChannels.length > 0}
                    onChange={(e) => selectAll(e.target.checked)}
                    className="rounded border border-blue-400"
                  />
                  Select All ({selectedChannels.size} selected)
                </label>
                {selectedChannels.size > 0 && (
                  <>
                    <span className="text-xs text-blue-300/60">|</span>
                    <button
                      type="button"
                      onClick={() => bulkToggleStatus(true)}
                      disabled={bulkActionLoading}
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                    >
                      ✓ Activate ({selectedChannels.size})
                    </button>
                    <button
                      type="button"
                      onClick={() => bulkToggleStatus(false)}
                      disabled={bulkActionLoading}
                      className="text-xs font-semibold text-amber-400 hover:text-amber-300 disabled:opacity-50"
                    >
                      ✗ Deactivate ({selectedChannels.size})
                    </button>
                    <button
                      type="button"
                      onClick={() => bulkDelete()}
                      disabled={bulkActionLoading}
                      className="text-xs font-semibold text-rose-400 hover:text-rose-300 disabled:opacity-50"
                    >
                      🗑 Delete ({selectedChannels.size})
                    </button>
                  </>
                )}
              </div>
            )}

            {loading && channels.length === 0 ? (
              <p className="text-sm text-zinc-400">Loading…</p>
            ) : channels.length === 0 ? (
              <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
                Database-এ কোনো channel নেই। উপরের form দিয়ে যোগ করুন বা M3U Sync চালান।
              </p>
            ) : filteredAdminChannels.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-center">
                <p className="text-sm text-zinc-400 mb-2">এই search/filter-এ কোনো channel পাওয়া যায়নি।</p>
                <button type="button" onClick={() => { setChannelQuery(""); setChannelModuleFilter("all"); }}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">Clear filters →</button>
              </div>
            ) : (
              <div className="max-h-[32rem] overflow-auto rounded-lg border border-white/10">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-[1] bg-[#0c0e14]">
                    {adminTable.getHeaderGroups().map((hg) => (
                      <tr key={hg.id} className="border-b border-white/10">
                        {hg.headers.map((h) => (
                          <th key={h.id} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                            {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {adminTable.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b border-white/[0.06] transition hover:bg-white/[0.03]">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="align-middle px-3 py-2.5 text-zinc-300">
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

        {/* ── Users Management ── */}
        <section className="w-full">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="admin-glass rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Users Management</h3>
              <button
                type="button"
                onClick={() => {
                  if (authToken) {
                    void (async () => {
                      try {
                        const res = await apiClient.adminListUsers(authToken, 1, 100);
                        console.log("Users:", res);
                        toast.success(`Loaded ${res.items.length} users`);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to load users");
                      }
                    })();
                  }
                }}
                className="player-control-btn text-xs"
              >
                Refresh Users
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-3">Total users: {stats?.users ?? 0}</p>
            <div className="rounded-lg border border-white/5 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/5 bg-white/2">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold text-zinc-300">Email</th>
                    <th className="px-3 py-2.5 font-semibold text-zinc-300">Name</th>
                    <th className="px-3 py-2.5 font-semibold text-zinc-300">Admin</th>
                    <th className="px-3 py-2.5 font-semibold text-zinc-300">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-zinc-500">
                      Click &quot;Refresh Users&quot; to load user list (currently loading on demand)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        </section>

        {/* ── Google AdSense Settings ── */}
        <AdminAdsenseSection />
      </div>
    </main>
  );
}

/* ─── AdSense sub-component ─────────────────────────────────────────── */

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
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="admin-glass rounded-2xl border border-amber-400/20 p-5 ring-1 ring-amber-500/10">
      <div className="mb-4 flex items-center gap-2">
        <Megaphone size={18} className="text-amber-400" />
        <h2 className="text-lg font-semibold text-white">Google AdSense Settings</h2>
      </div>
      <p className="mb-4 text-xs text-zinc-400">
        আপনার Google AdSense Publisher ID এবং Slot IDs প্রদান করুন।
        <strong className="text-zinc-300"> ca-pub-XXXXXXXXXX</strong> ফরম্যাটের ID AdSense account থেকে পাবেন।
        Premium users-এর কাছে ad দেখাবে না।
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="col-span-full">
          <label className="mb-1 block text-xs font-semibold text-zinc-400">Publisher ID</label>
          <input value={form.adsensePublisherId} onChange={(e) => setForm((p) => ({ ...p, adsensePublisherId: e.target.value }))}
            placeholder="ca-pub-1234567890123456"
            className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-amber-400" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-400">Banner Ad Slot ID</label>
          <input value={form.adsenseBannerSlot} onChange={(e) => setForm((p) => ({ ...p, adsenseBannerSlot: e.target.value }))}
            placeholder="1234567890"
            className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-amber-400" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-400">Inline Ad Slot ID</label>
          <input value={form.adsenseInlineSlot} onChange={(e) => setForm((p) => ({ ...p, adsenseInlineSlot: e.target.value }))}
            placeholder="0987654321"
            className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-amber-400" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={form.adsenseEnabled} onChange={(e) => setForm((p) => ({ ...p, adsenseEnabled: e.target.checked }))}
            className="h-4 w-4 accent-amber-400" />
          <span className="text-sm text-zinc-300">AdSense Enable করুন</span>
        </label>
        <button type="button" onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400">
          <Settings2 size={15} />{saved ? "✓ Saved!" : "Save Settings"}
        </button>
      </div>
      <p className="mt-3 text-[10px] text-zinc-600">
        Changes take effect on next page load. Ensure your domain is approved in Google AdSense.
      </p>
    </motion.section>
  );
}
