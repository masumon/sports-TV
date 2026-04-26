"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Save, Trash2, Pencil, X, Check, Settings2, Megaphone, Search, Filter } from "lucide-react";
import Image from "next/image";
import { apiClient } from "@/lib/apiClient";
import type { AdminStats, Channel, LiveScore } from "@/lib/types";
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

type ScoreFormState = {
  sport_type: "football" | "cricket";
  league: string;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  match_minute: string;
  status: "live" | "upcoming" | "finished";
  extra_data: string;
};

type EditScoreState = {
  score_home: number;
  score_away: number;
  match_minute: string;
  status: "live" | "upcoming" | "finished";
};

const initialChannelForm: ChannelFormState = {
  name: "",
  country: "Global",
  category: "Sports",
  language: "Unknown",
  logo_url: "",
  stream_url: "",
  quality_tag: "auto",
  module: "sports",
};

const initialScoreForm: ScoreFormState = {
  sport_type: "football",
  league: "",
  team_home: "",
  team_away: "",
  score_home: 0,
  score_away: 0,
  match_minute: "",
  status: "live",
  extra_data: "",
};

export default function AdminDashboardPage() {
  const { token, user, clearSession } = useAuthStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [scores, setScores] = useState<LiveScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelForm, setChannelForm] = useState<ChannelFormState>(initialChannelForm);
  const [scoreForm, setScoreForm] = useState<ScoreFormState>(initialScoreForm);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [editingScoreId, setEditingScoreId] = useState<number | null>(null);
  const [editScoreData, setEditScoreData] = useState<EditScoreState>({ score_home: 0, score_away: 0, match_minute: "", status: "live" });
  const [channelQuery, setChannelQuery] = useState("");
  const [channelModuleFilter, setChannelModuleFilter] = useState<"all" | "sports" | "india" | "bangladesh">("all");
  const [scoreQuery, setScoreQuery] = useState("");

  const authToken = token;

  const filteredScores = useMemo(() => {
    const q = scoreQuery.trim().toLowerCase();
    if (!q) return scores;
    return scores.filter(
      (s) =>
        s.league.toLowerCase().includes(q) ||
        s.team_home.toLowerCase().includes(q) ||
        s.team_away.toLowerCase().includes(q) ||
        (s.sport_type && s.sport_type.toLowerCase().includes(q))
    );
  }, [scores, scoreQuery]);

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
    setLoading(true);
    setError(null);
    try {
      const [channelRes, scoreRes] = await Promise.all([
        apiClient.adminListChannels(authToken),
        apiClient.adminListScores(authToken),
      ]);
      setChannels(channelRes);
      setScores(scoreRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড করা যায়নি");
    } finally {
      setLoading(false);
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

  useEffect(() => {
    if (!authToken) return;
    void fetchAdminData();
    void fetchStats();
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

  const createScore = async () => {
    if (!authToken) return;
    setError(null);
    if (!scoreForm.league.trim()) return setFormError("League / Tournament is required.");
    if (!scoreForm.team_home.trim()) return setFormError("Home team is required.");
    if (!scoreForm.team_away.trim()) return setFormError("Away team is required.");
    if (scoreForm.score_home < 0 || scoreForm.score_away < 0) return setFormError("Scores cannot be negative.");
    try {
      await apiClient.adminCreateScore(authToken, {
        ...scoreForm,
        league: scoreForm.league.trim(),
        team_home: scoreForm.team_home.trim(),
        team_away: scoreForm.team_away.trim(),
        match_minute: scoreForm.match_minute.trim() || null,
        extra_data: scoreForm.extra_data.trim() || null,
      });
      setScoreForm(initialScoreForm);
      await fetchAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "স্কোর তৈরি ব্যর্থ");
    }
  };

  const deleteChannel = async (id: number) => {
    if (!authToken) return;
    try {
      await apiClient.adminDeleteChannel(authToken, id);
      await fetchAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "চ্যানেল ডিলিট ব্যর্থ");
    }
  };

  const deleteScore = async (id: number) => {
    if (!authToken) return;
    try {
      await apiClient.adminDeleteScore(authToken, id);
      if (editingScoreId === id) setEditingScoreId(null);
      await fetchAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "স্কোর ডিলিট ব্যর্থ");
    }
  };

  const updateScore = async (id: number) => {
    if (!authToken) return;
    setError(null);
    try {
      await apiClient.adminUpdateScore(authToken, id, {
        score_home: editScoreData.score_home,
        score_away: editScoreData.score_away,
        match_minute: editScoreData.match_minute || null,
        status: editScoreData.status,
      });
      setEditingScoreId(null);
      await fetchAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "স্কোর আপডেট ব্যর্থ");
    }
  };

  const syncM3u = async () => {
    if (!authToken) return;
    setSyncing(true);
    setError(null);
    try {
      await apiClient.adminSyncChannels(authToken);
      await fetchAdminData();
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "M3U Sync ব্যর্থ");
    } finally {
      setSyncing(false);
    }
  };

  if (!authToken || !user?.is_admin) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="mb-4 text-zinc-200">অ্যাডমিন অ্যাক্সেস প্রয়োজন। আগে লগইন করুন।</p>
          <a
            href="/admin/login"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Admin Login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main data-admin className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image src="/icons/abo-logo.svg" alt="ABO" width={36} height={36} className="rounded-xl" />
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-sm text-zinc-400">চ্যানেল ও লাইভ স্কোর ম্যানেজ করুন · ABO SPORTS TV LIVE</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              void fetchAdminData();
              void fetchStats();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void syncM3u()}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
          >
            <Save size={16} />
            {syncing ? "Syncing..." : "Sync IPTV M3U"}
          </button>
          <button
            type="button"
            onClick={clearSession}
            className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/20"
          >
            Logout
          </button>
        </div>
      </header>

      {stats ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-zinc-500">Users</p>
              <p className="text-2xl font-bold text-white">{stats.users}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-zinc-500">Channels (all)</p>
              <p className="text-2xl font-bold text-white">{stats.channels}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-zinc-500">Active channels</p>
              <p className="text-2xl font-bold text-white">{stats.active_channels}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-zinc-500">Live scores</p>
              <p className="text-2xl font-bold text-white">{stats.live_scores}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-zinc-500">Cache / job / last sync</p>
              <p className="text-sm text-zinc-200">
                {stats.cache_ttl_seconds}s · {stats.scheduled_sync_minutes || "off"}m
                {stats.last_sync_at ? (
                  <>
                    <br />
                    <span className="text-xs text-zinc-500">{new Date(stats.last_sync_at).toLocaleString()}</span>
                  </>
                ) : null}
              </p>
            </div>
          </section>
          <div className="flex flex-wrap gap-4">
            {[
              { label: "Users", n: stats.users, color: "from-sky-500/80" },
              { label: "Channels", n: stats.channels, color: "from-violet-500/80" },
              { label: "Active", n: stats.active_channels, color: "from-emerald-500/80" },
              { label: "Scores", n: stats.live_scores, color: "from-amber-500/80" },
            ].map((m) => {
              const max = Math.max(1, stats.users, stats.channels, stats.active_channels, stats.live_scores);
              return (
                <div key={m.label} className="min-w-[100px] flex-1">
                  <p className="mb-1 text-[10px] text-zinc-500">{m.label}</p>
                  <div className="flex h-24 items-end overflow-hidden rounded-md bg-zinc-800/50">
                    <div
                      className={`w-full min-h-[2px] rounded-t bg-gradient-to-t ${m.color} to-transparent/10`}
                      style={{ height: `${(m.n / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {error && (
        <div className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-5"
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
                    <option value="sports">sports</option>
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

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          <h2 className="mb-1 text-lg font-semibold text-white">নতুন লাইভ স্কোর</h2>
          <p className="mb-4 text-xs text-zinc-500">League and team names are required.</p>
          <div className="grid gap-3">
            <select
              value={scoreForm.sport_type}
              onChange={(e) =>
                setScoreForm((prev) => ({ ...prev, sport_type: e.target.value as "football" | "cricket" }))
              }
              className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
            >
              <option value="football">Football</option>
              <option value="cricket">Cricket</option>
            </select>
            <input
              value={scoreForm.league}
              onChange={(e) => setScoreForm((prev) => ({ ...prev, league: e.target.value }))}
              className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
              placeholder="League / Tournament"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={scoreForm.team_home}
                onChange={(e) => setScoreForm((prev) => ({ ...prev, team_home: e.target.value }))}
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                placeholder="Home team"
                required
              />
              <input
                value={scoreForm.team_away}
                onChange={(e) => setScoreForm((prev) => ({ ...prev, team_away: e.target.value }))}
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                placeholder="Away team"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min={0}
                value={scoreForm.score_home}
                onChange={(e) => setScoreForm((prev) => ({ ...prev, score_home: Number(e.target.value) }))}
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                placeholder="Home score"
              />
              <input
                type="number"
                min={0}
                value={scoreForm.score_away}
                onChange={(e) => setScoreForm((prev) => ({ ...prev, score_away: Number(e.target.value) }))}
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                placeholder="Away score"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={scoreForm.match_minute}
                onChange={(e) => setScoreForm((prev) => ({ ...prev, match_minute: e.target.value }))}
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                placeholder="Minute / Over"
              />
              <select
                value={scoreForm.status}
                onChange={(e) =>
                  setScoreForm((prev) => ({
                    ...prev,
                    status: e.target.value as "live" | "upcoming" | "finished",
                  }))
                }
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
              >
                <option value="live">Live</option>
                <option value="upcoming">Upcoming</option>
                <option value="finished">Finished</option>
              </select>
            </div>
            <textarea
              value={scoreForm.extra_data}
              onChange={(e) => setScoreForm((prev) => ({ ...prev, extra_data: e.target.value }))}
              className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
              placeholder="Extra data (JSON/string)"
              rows={3}
            />
            <button
              type="button"
              onClick={() => void createScore()}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
            >
              Add Live Score
            </button>
          </div>
        </motion.div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
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
                onChange={(e) => setChannelModuleFilter(e.target.value as "all" | "sports" | "india" | "bangladesh")}
                className="min-w-[8rem] rounded-lg border border-white/20 bg-black/30 px-2 py-2 text-sm text-white outline-none focus:border-emerald-400"
              >
                <option value="all">All modules</option>
                <option value="sports">sports</option>
                <option value="india">india</option>
                <option value="bangladesh">bangladesh</option>
              </select>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-zinc-400">Loading...</p>
          ) : channels.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">No channels in the database yet. Add one using the form above, or run M3U sync.</p>
          ) : filteredAdminChannels.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">No channels match this search. Clear the filter or try different keywords.</p>
          ) : (
            <p className="mb-2 text-xs text-zinc-500">Showing {filteredAdminChannels.length} of {channels.length} channels</p>
          )}
          {!loading && channels.length > 0 && filteredAdminChannels.length > 0 && (
            <div className="max-h-96 space-y-2 overflow-auto pr-0.5">
              {filteredAdminChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-black/30 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{channel.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {channel.country} · {channel.module}
                    </p>
                    <p className="mt-0.5 line-clamp-2 break-all text-[11px] text-zinc-500">
                      {channel.category} · {channel.language} · {channel.quality_tag}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteChannel(channel.id)}
                    className="shrink-0 rounded-lg border border-rose-300/30 bg-rose-500/10 p-2 text-rose-200 hover:bg-rose-500/20"
                    title="Delete channel"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-2 text-lg font-semibold text-white">লাইভ স্কোর তালিকা</h2>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              value={scoreQuery}
              onChange={(e) => setScoreQuery(e.target.value)}
              placeholder="Filter by league or team…"
              className="w-full rounded-lg border border-white/20 bg-black/30 py-2 pl-8 pr-3 text-sm text-white outline-none focus:border-emerald-400"
              aria-label="Filter scores"
            />
          </div>
          {loading ? (
            <p className="text-sm text-zinc-400">Loading...</p>
          ) : scores.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-zinc-400">No live scores yet. Add a match using the form on the left.</p>
          ) : filteredScores.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-zinc-400">No scores match this filter. Clear the search or try a team or league name.</p>
          ) : (
            <p className="mb-2 text-xs text-zinc-500">Showing {filteredScores.length} of {scores.length} rows</p>
          )}
          {loading || scores.length === 0 ? null : (
            <div className="max-h-96 space-y-2 overflow-auto pr-0.5">
              {filteredScores.map((score) => (
                editingScoreId === score.id ? (
                  <div key={score.id} className="rounded-lg border border-amber-400/30 bg-amber-500/5 p-3 space-y-2">
                    <p className="text-xs font-semibold text-zinc-300">
                      {score.team_home} vs {score.team_away}
                      <span className="ml-1 text-zinc-500">· {score.league}</span>
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={editScoreData.score_home}
                        onChange={(e) => setEditScoreData((p) => ({ ...p, score_home: Number(e.target.value) }))}
                        className="rounded border border-white/20 bg-black/40 px-2 py-1 text-sm text-white" placeholder="Home" />
                      <input type="number" value={editScoreData.score_away}
                        onChange={(e) => setEditScoreData((p) => ({ ...p, score_away: Number(e.target.value) }))}
                        className="rounded border border-white/20 bg-black/40 px-2 py-1 text-sm text-white" placeholder="Away" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={editScoreData.match_minute}
                        onChange={(e) => setEditScoreData((p) => ({ ...p, match_minute: e.target.value }))}
                        className="rounded border border-white/20 bg-black/40 px-2 py-1 text-sm text-white" placeholder="Minute / Over" />
                      <select value={editScoreData.status}
                        onChange={(e) => setEditScoreData((p) => ({ ...p, status: e.target.value as EditScoreState["status"] }))}
                        className="rounded border border-white/20 bg-black/40 px-2 py-1 text-sm text-white">
                        <option value="live">🔴 Live</option>
                        <option value="upcoming">🕐 Upcoming</option>
                        <option value="finished">✅ Finished</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void updateScore(score.id)}
                        className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500">
                        <Check size={12} /> Save
                      </button>
                      <button type="button" onClick={() => setEditingScoreId(null)}
                        className="inline-flex items-center gap-1 rounded bg-zinc-700 px-2.5 py-1 text-xs text-white hover:bg-zinc-600">
                        <X size={12} /> Cancel
                      </button>
                      <button type="button" onClick={() => void deleteScore(score.id)}
                        className="ml-auto rounded border border-rose-300/30 bg-rose-500/10 p-1 text-rose-200 hover:bg-rose-500/20">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                <div
                  key={score.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {score.team_home} {score.score_home} - {score.score_away} {score.team_away}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {score.league} · <span className={score.status === "live" ? "text-red-400" : score.status === "upcoming" ? "text-sky-400" : "text-zinc-500"}>{score.status}</span>
                      {score.match_minute ? ` · ${score.match_minute}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => { setEditingScoreId(score.id); setEditScoreData({ score_home: score.score_home, score_away: score.score_away, match_minute: score.match_minute ?? "", status: score.status }); }}
                      className="rounded-lg border border-amber-300/30 bg-amber-500/10 p-2 text-amber-200 hover:bg-amber-500/20"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteScore(score.id)}
                      className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-2 text-rose-200 hover:bg-rose-500/20"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                )
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Google AdSense Settings ── */}
      <AdminAdsenseSection />
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
      className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5"
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
