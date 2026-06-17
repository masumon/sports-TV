"use client";

import { useEffect, useState } from "react";
import { RefreshCw, TrendingUp, AlertTriangle, Search, Zap, Eye } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import type { AdminAnalyticsSummary } from "@/lib/types";

function StatBadge({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <span className="text-xl font-black tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-50">{label}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={14} className="opacity-60" />
      <h3 className="text-[11px] font-black uppercase tracking-widest opacity-60">{title}</h3>
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5 py-1">
      <span className="w-36 shrink-0 truncate text-[11px] font-medium opacity-80" title={label}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="shrink-0 text-[11px] font-bold tabular-nums opacity-70">{value}</span>
    </div>
  );
}

function generateInsights(data: AdminAnalyticsSummary): string[] {
  const tips: string[] = [];
  const { playback, top_failed, most_watched, search_no_results, quick_exits } = data;

  if (playback.success_pct < 60) tips.push(`🔴 Playback success rate is critically low (${playback.success_pct}%) — stream sources need urgent review`);
  else if (playback.success_pct < 85) tips.push(`🟡 Playback success rate is ${playback.success_pct}% — below target, check top failed channels`);

  if (top_failed[0]) tips.push(`⚠️ "${top_failed[0].channel_name}" failed ${top_failed[0].fail_count}× — likely dead stream URL`);

  if (search_no_results.length >= 3) {
    const terms = search_no_results.slice(0, 3).map(s => `"${s.term}"`).join(", ");
    tips.push(`🔍 Users searching for ${terms} — consider adding these channels`);
  }

  if (quick_exits[0] && quick_exits[0].exit_count > 2) tips.push(`⚡ "${quick_exits[0].channel_name}" has ${quick_exits[0].exit_count} quick exits — stream may be slow or broken`);

  if (most_watched[0]) tips.push(`📺 "${most_watched[0].channel_name}" is most popular (${most_watched[0].views} views) — prioritize its uptime`);

  if (playback.attempts === 0) tips.push("📊 No playback data yet — events will appear as users watch channels");

  return tips.slice(0, 5);
}

export function InsightsDashboard({ token }: { token: string }) {
  const [data, setData] = useState<AdminAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState(24);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getAnalyticsSummary(token, hours);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [hours]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxFail = data?.top_failed[0]?.fail_count ?? 1;
  const maxWatch = data?.most_watched[0]?.views ?? 1;
  const maxExit = data?.quick_exits[0]?.exit_count ?? 1;
  const maxSearch = data?.search_no_results[0]?.count ?? 1;
  const insights = data ? generateInsights(data) : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: "var(--primary-accent)" }}>
          Insights Dashboard
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="rounded-lg px-2 py-1 text-[11px] font-bold"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "inherit" }}
          >
            <option value={6}>6h</option>
            <option value={24}>24h</option>
            <option value={48}>48h</option>
            <option value={168}>7d</option>
          </select>
          <button type="button" onClick={() => void load()} disabled={loading}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold disabled:opacity-50 transition hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-3 text-[12px]" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {/* 1. Playback Success Rate */}
      <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <SectionHeader icon={TrendingUp} title="Playback Success Rate" />
        {data ? (
          <div className="flex flex-wrap gap-2.5">
            <StatBadge value={data.playback.attempts} label="Attempts" color="rgba(255,255,255,0.7)" />
            <StatBadge value={data.playback.successes} label="Succeeded" color="#4ade80" />
            <StatBadge value={data.playback.failures} label="Failed" color="#f87171" />
            <StatBadge
              value={`${data.playback.success_pct}%`}
              label="Success"
              color={data.playback.success_pct >= 85 ? "#4ade80" : data.playback.success_pct >= 60 ? "#fbbf24" : "#f87171"}
            />
          </div>
        ) : <div className="h-14 animate-pulse rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }} />}
      </div>

      {/* 2 + 3: Side by side on wide, stacked on mobile */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top Failed Channels */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <SectionHeader icon={AlertTriangle} title="Top Failed Channels" />
          {data ? (
            data.top_failed.length ? data.top_failed.slice(0, 5).map((r) => (
              <BarRow key={r.channel_id} label={r.channel_name} value={r.fail_count} max={maxFail} color="#f87171" />
            )) : <p className="text-[11px] opacity-40">No failures in this period</p>
          ) : <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-5 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.05)" }} />)}</div>}
        </div>

        {/* Most Watched */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <SectionHeader icon={Eye} title="Most Watched Channels" />
          {data ? (
            data.most_watched.length ? data.most_watched.slice(0, 5).map((r) => (
              <BarRow key={r.channel_id} label={r.channel_name} value={r.views} max={maxWatch} color="#60a5fa" />
            )) : <p className="text-[11px] opacity-40">No playback data yet</p>
          ) : <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-5 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.05)" }} />)}</div>}
        </div>

        {/* Search No Results */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <SectionHeader icon={Search} title="Searches With No Results" />
          {data ? (
            data.search_no_results.length ? data.search_no_results.slice(0, 8).map((r) => (
              <BarRow key={r.term} label={r.term} value={r.count} max={maxSearch} color="#fbbf24" />
            )) : <p className="text-[11px] opacity-40">No empty searches in this period</p>
          ) : <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-5 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.05)" }} />)}</div>}
        </div>

        {/* Quick Exits */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <SectionHeader icon={Zap} title="Users Leaving Within 10s" />
          {data ? (
            data.quick_exits.length ? data.quick_exits.slice(0, 5).map((r) => (
              <BarRow key={r.channel_id} label={r.channel_name} value={r.exit_count} max={maxExit} color="#a78bfa" />
            )) : <p className="text-[11px] opacity-40">No quick exits in this period</p>
          ) : <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-5 animate-pulse rounded" style={{ background: "rgba(255,255,255,0.05)" }} />)}</div>}
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <SectionHeader icon={Zap} title="Auto-Generated Insights" />
          <ul className="space-y-2">
            {insights.map((tip, i) => (
              <li key={i} className="rounded-xl px-3 py-2 text-[12px] leading-relaxed"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
