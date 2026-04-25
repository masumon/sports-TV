"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Save, Trash2, Pencil, X, Check } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import type { AdminStats, Channel, LiveScore } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";

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

  const authToken = token;

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

  useEffect(() => {
    if (!authToken || !user?.is_admin) return;
    const k = "gstv_admin_bg_sync";
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
    const t = setTimeout(() => {
      void (async () => {
        try {
          await apiClient.adminSyncChannels(authToken);
          await fetchAdminData();
          await fetchStats();
        } catch {
          /* rate limit / network */
        }
      })();
    }, 4000);
    return () => clearTimeout(t);
  }, [authToken, user?.is_admin]);

  useEffect(() => {
    if (!authToken) return;
    const id = setInterval(() => {
      void (async () => {
        try {
          await apiClient.adminSyncChannels(authToken);
          await fetchAdminData();
          await fetchStats();
        } catch {
          /* */
        }
      })();
    }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [authToken]);

  const createChannel = async () => {
    if (!authToken) return;
    setError(null);
    try {
      await apiClient.adminCreateChannel(authToken, {
        ...channelForm,
        logo_url: channelForm.logo_url || null,
        stream_url: channelForm.stream_url,
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
    try {
      await apiClient.adminCreateScore(authToken, {
        ...scoreForm,
        match_minute: scoreForm.match_minute || null,
        extra_data: scoreForm.extra_data || null,
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
    <main className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-sm text-zinc-400">চ্যানেল ও লাইভ স্কোর ম্যানেজ করুন</p>
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
          <h2 className="mb-4 text-lg font-semibold text-white">নতুন চ্যানেল যোগ করুন</h2>
          <div className="grid gap-3">
            {Object.entries(channelForm).map(([key, value]) => (
              <input
                key={key}
                value={value}
                onChange={(e) => setChannelForm((prev) => ({ ...prev, [key]: e.target.value }))}
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                placeholder={key}
              />
            ))}
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
          <h2 className="mb-4 text-lg font-semibold text-white">নতুন লাইভ স্কোর</h2>
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
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={scoreForm.team_home}
                onChange={(e) => setScoreForm((prev) => ({ ...prev, team_home: e.target.value }))}
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                placeholder="Home team"
              />
              <input
                value={scoreForm.team_away}
                onChange={(e) => setScoreForm((prev) => ({ ...prev, team_away: e.target.value }))}
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                placeholder="Away team"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={scoreForm.score_home}
                onChange={(e) => setScoreForm((prev) => ({ ...prev, score_home: Number(e.target.value) }))}
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
                placeholder="Home score"
              />
              <input
                type="number"
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
          <h2 className="mb-4 text-lg font-semibold text-white">চ্যানেল তালিকা</h2>
          {loading ? (
            <p className="text-sm text-zinc-400">Loading...</p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-auto">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{channel.name}</p>
                    <p className="text-xs text-zinc-400">{channel.country}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteChannel(channel.id)}
                    className="rounded-lg border border-rose-300/30 bg-rose-500/10 p-2 text-rose-200 hover:bg-rose-500/20"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">লাইভ স্কোর তালিকা</h2>
          {loading ? (
            <p className="text-sm text-zinc-400">Loading...</p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-auto">
              {scores.map((score) => (
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
    </main>
  );
}
