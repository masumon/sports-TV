"use client";

import { Bell, BellOff, Calendar, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { startTransition, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  checkAndFireUpcomingNotifications,
  getNotifPermission,
  getNotifPref,
  isNotificationsSupported,
  requestNotifPermission,
  setNotifPref,
} from "@/lib/matchNotifications";
import { WcLiveSourcePicker } from "@/components/world-cup/WcLiveSourcePicker";
import type { Channel, LiveFixture, ViewerModule } from "@/lib/types";

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
};

type TabId = "live" | "upcoming" | "finished";

function getStatus(fx: LiveFixture): TabId {
  const now = Date.now();
  const startMs = fx.starts_at_utc ? new Date(fx.starts_at_utc).getTime() : 0;
  const elapsed = startMs > 0 ? (now - startMs) / 60_000 : 0;
  const s = (fx.status || "").toLowerCase();
  if (s === "finished" || elapsed > 130) return "finished";
  if (startMs > 0 && startMs <= now) return "live";
  return "upcoming";
}

export function WorldCupSchedule({
  fixtures,
  loading,
  wcChannels,
  onRefresh,
  onSelectChannel,
  onModuleChange,
}: {
  fixtures: LiveFixture[];
  loading: boolean;
  wcChannels: Channel[];
  onRefresh: () => void;
  onSelectChannel: (ch: Channel) => void;
  onModuleChange: (m: ViewerModule) => void;
}) {
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    // will be updated by useEffect after fixtures load
    return "upcoming";
  });
  const [expandedSource, setExpandedSource] = useState<number | null>(null);

  useEffect(() => {
    setNotifPerm(getNotifPermission());
    setNotifEnabled(getNotifPref());
  }, []);

  // Check for upcoming matches every 60s and fire notifications
  useEffect(() => {
    if (!notifEnabled || notifPerm !== "granted" || !fixtures.length) return;
    checkAndFireUpcomingNotifications(fixtures);
    const id = setInterval(() => checkAndFireUpcomingNotifications(fixtures), 60_000);
    return () => clearInterval(id);
  }, [fixtures, notifEnabled, notifPerm]);

  // Auto-switch to "live" tab when live matches are present
  useEffect(() => {
    const hasLive = fixtures.some((f) => getStatus(f) === "live");
    if (hasLive) setActiveTab("live");
  }, [fixtures]);

  const handleToggleNotif = useCallback(async () => {
    if (!isNotificationsSupported()) {
      toast.error("Your browser doesn't support notifications");
      return;
    }
    if (notifEnabled) {
      setNotifEnabled(false);
      setNotifPref(false);
      toast.info("Match alerts disabled");
      return;
    }
    const perm = await requestNotifPermission();
    setNotifPerm(perm);
    if (perm === "granted") {
      setNotifEnabled(true);
      setNotifPref(true);
      toast.success("✓ Match alerts enabled — you'll be notified 15 min before kickoff");
    } else {
      toast.error("Notifications blocked — enable in your browser settings", { duration: 5000 });
    }
  }, [notifEnabled]);

  const liveList = fixtures
    .filter((f) => getStatus(f) === "live")
    .sort((a, b) => new Date(b.starts_at_utc).getTime() - new Date(a.starts_at_utc).getTime());

  const upcomingList = fixtures
    .filter((f) => getStatus(f) === "upcoming")
    .sort((a, b) => new Date(a.starts_at_utc).getTime() - new Date(b.starts_at_utc).getTime());

  const finishedList = fixtures
    .filter((f) => getStatus(f) === "finished")
    .sort((a, b) => new Date(b.starts_at_utc).getTime() - new Date(a.starts_at_utc).getTime());

  const activeList =
    activeTab === "live" ? liveList : activeTab === "upcoming" ? upcomingList : finishedList;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "linear-gradient(180deg, rgba(245,166,35,0.06) 0%, transparent 100%)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar size={16} className="shrink-0" style={{ color: "var(--primary-accent)" }} />
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate" style={{ color: "var(--text-main)" }}>
              বিশ্বকাপ ২০২৬ সময়সূচি
            </h3>
            {fixtures.length === 0 && !loading && (
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Backend-এ <code>FOOTBALL_DATA_ORG_API_TOKEN</code> set করলে schedule দেখাবে
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isNotificationsSupported() && (
            <button
              type="button"
              onClick={() => void handleToggleNotif()}
              title={notifEnabled ? "Match alerts are ON — click to disable" : "Click to enable match alerts"}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:opacity-80 active:scale-95"
              style={{
                background: notifEnabled ? "rgba(245,166,35,0.18)" : "rgba(255,255,255,0.06)",
                border: notifEnabled ? "1px solid rgba(245,166,35,0.45)" : "1px solid rgba(255,255,255,0.12)",
                color: notifEnabled ? "var(--primary-accent)" : "var(--text-muted)",
              }}
            >
              {notifEnabled ? <Bell size={12} /> : <BellOff size={12} />}
              <span className="hidden sm:inline">
                {notifEnabled ? "অ্যালার্ট চালু" : "অ্যালার্ট পান"}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-white/10"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)" }}
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
        {(["live", "upcoming", "finished"] as const).map((tab) => {
          const count =
            tab === "live" ? liveList.length : tab === "upcoming" ? upcomingList.length : finishedList.length;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold transition"
              style={{
                background: isActive ? "rgba(245,166,35,0.06)" : "transparent",
                color: isActive ? "var(--primary-accent)" : "var(--text-muted)",
                borderBottom: isActive ? "2px solid var(--primary-accent)" : "2px solid transparent",
              }}
            >
              {tab === "live" && count > 0 && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400 animate-pulse" />
              )}
              {tab === "live" ? "🔴 LIVE" : tab === "upcoming" ? "⏰ Upcoming" : "✓ Results"}
              {count > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums"
                  style={{
                    background: tab === "live" ? "rgba(239,68,68,0.18)" : "rgba(245,166,35,0.12)",
                    color: tab === "live" ? "#f87171" : "var(--primary-accent)",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Fixture list */}
      <div
        className="max-h-[min(50dvh,24rem)] overflow-y-auto overscroll-y-contain divide-y"
        style={{ borderColor: "var(--border)" }}
      >
        {loading && activeList.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-4 py-3 animate-pulse space-y-2">
              <div className="h-3 w-2/3 rounded" style={{ background: "var(--bg-hover)" }} />
              <div className="h-4 w-full rounded" style={{ background: "var(--bg-hover)" }} />
            </div>
          ))
        ) : activeList.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Calendar size={28} style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {activeTab === "live"
                ? "এখন কোনো ম্যাচ চলছে না"
                : activeTab === "upcoming"
                  ? "আসন্ন ম্যাচের তথ্য লোড হচ্ছে…"
                  : "কোনো শেষ হওয়া ম্যাচ নেই"}
            </p>
          </div>
        ) : (
          activeList.slice(0, 24).map((fx) => {
            const status = getStatus(fx);
            const isLive = status === "live";
            const isFinished = status === "finished";
            const startMs = fx.starts_at_utc ? new Date(fx.starts_at_utc).getTime() : 0;
            const now = Date.now();
            const elapsedMin = startMs > 0 ? Math.floor((now - startMs) / 60_000) : 0;

            return (
              <div key={fx.id} className="px-4 py-3 transition hover:bg-white/[0.02]">
                {/* Competition + Status row */}
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span
                    className="min-w-0 truncate text-[10px] font-semibold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    🏆 {fx.league_name}
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                    style={{
                      background: isLive
                        ? "rgba(239,68,68,0.15)"
                        : isFinished
                          ? "rgba(120,120,120,0.1)"
                          : "rgba(245,166,35,0.1)",
                      color: isLive ? "#f87171" : isFinished ? "var(--text-muted)" : "var(--primary-accent)",
                      border: `1px solid ${isLive ? "rgba(239,68,68,0.3)" : isFinished ? "rgba(120,120,120,0.2)" : "rgba(245,166,35,0.25)"}`,
                    }}
                  >
                    {isLive ? `🔴 ${elapsedMin}'` : isFinished ? "✓ FT" : "⏰"}
                  </span>
                </div>

                {/* Teams */}
                <div className="flex items-center gap-2">
                  <p
                    className="min-w-0 flex-1 truncate text-right text-sm font-bold"
                    style={{ color: isLive ? "var(--text-main)" : "var(--text-main)" }}
                  >
                    {fx.home_team}
                  </p>
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}
                  >
                    VS
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-bold" style={{ color: "var(--text-main)" }}>
                    {fx.away_team}
                  </p>
                </div>

                {/* Time + countdown */}
                {!isLive && startMs > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      🕐 {new Date(fx.starts_at_utc).toLocaleString(undefined, TIME_FORMAT)}
                    </p>
                    {!isFinished && startMs > Date.now() && (() => {
                      const minLeft = Math.round((startMs - Date.now()) / 60_000);
                      const label = minLeft < 60
                        ? `${minLeft}m`
                        : minLeft < 1440
                          ? `${Math.floor(minLeft / 60)}h ${minLeft % 60}m`
                          : `${Math.floor(minLeft / 1440)}d`;
                      return (
                        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "rgba(245,166,35,0.12)", color: "var(--primary-accent)" }}>
                          ⏳ in {label}
                        </span>
                      );
                    })()}
                  </div>
                )}

                {/* Watch sources — live matches get full picker, others show channel chips */}
                {isLive ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setExpandedSource(expandedSource === fx.id ? null : fx.id)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition hover:opacity-90 active:scale-95"
                      style={{
                        background: "rgba(239,68,68,0.14)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        color: "#f87171",
                      }}
                    >
                      📺 সরাসরি দেখুন
                      {expandedSource === fx.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                    {expandedSource === fx.id && (
                      <WcLiveSourcePicker
                        fixture={fx}
                        wcChannels={wcChannels}
                        onSelectChannel={(ch) => {
                          startTransition(() => onModuleChange(ch.module as ViewerModule));
                          onSelectChannel(ch);
                        }}
                      />
                    )}
                  </div>
                ) : fx.suggested_channels?.length ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="shrink-0 text-[10px]" style={{ color: "var(--text-muted)" }}>
                      📺 Watch:
                    </span>
                    {fx.suggested_channels.slice(0, 4).map((ch) => (
                      <button
                        key={`${fx.id}-${ch.id}`}
                        type="button"
                        onClick={() => {
                          startTransition(() => {
                            onModuleChange(ch.module as ViewerModule);
                          });
                          onSelectChannel(ch);
                          setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80);
                        }}
                        className="rounded-md px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-90 active:scale-95"
                        style={{
                          background: "rgba(245,166,35,0.1)",
                          border: "1px solid rgba(245,166,35,0.25)",
                          color: "var(--primary-accent)",
                        }}
                      >
                        ▶ {ch.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
