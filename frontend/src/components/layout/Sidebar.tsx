"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Home, X, Tv, Globe,
  Zap, Flame, Trophy,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/LocaleContext";
import { APP_META, LEGAL_LINKS } from "@/lib/constants";
import { useUiStore } from "@/store/uiStore";

const SPORTS_CATEGORIES = [
  { label: "Football", emoji: "⚽", key: "football" },
  { label: "Cricket", emoji: "🏏", key: "cricket" },
];

function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums"
      style={{ background: "rgba(245,166,35,0.12)", color: "var(--primary-accent)", border: "1px solid rgba(245,166,35,0.2)" }}
    >
      {count > 9999 ? "9999+" : count}
    </span>
  );
}

export function Sidebar() {
  const { t } = useI18n();
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const activeModule = useUiStore((s) => s.activeModule);
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  const activeCategory = useUiStore((s) => s.activeCategory);
  const setActiveCategory = useUiStore((s) => s.setActiveCategory);
  const { gsCount, bdCount, inCount, fastCount, wcCount } = useUiStore((s) => s.moduleCounts);
  const visibleCats = SPORTS_CATEGORIES;

  function handleCategoryClick(key: string) {
    if (activeModule !== "global_sports") setActiveModule("global_sports");
    setActiveCategory(activeCategory === key ? "" : key);
    setSidebarOpen(false);
    // Scroll to channel grid
    setTimeout(() => {
      document.getElementById("channel-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function handleBangladeshClick() {
    setActiveModule("bangladesh");
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleIndiaClick() {
    setActiveModule("india");
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleGlobalSportsClick() {
    setActiveModule("global_sports");
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleFastTvClick() {
    setActiveModule("fast_tv");
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleLiveMatchesClick() {
    setActiveModule("live_matches");
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleWorldCupClick() {
    setActiveModule("world_cup_2026");
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] transition-opacity md:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />

      <aside
        className={`fixed left-0 top-0 z-40 flex h-full w-64 flex-col transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } shrink-0 overflow-y-auto`}
        style={{
          background: "rgba(11,15,25,0.97)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          scrollbarWidth: "none",
        }}
      >
        {/* ── Logo / Brand ── */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4 py-4"
          style={{
            background: "linear-gradient(180deg, rgba(11,15,25,0.99) 0%, rgba(14,19,31,0.97) 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative h-14 w-14 shrink-0">
              <Image
                src="/icons/abo-sports-tv-logo.png"
                alt="ABO Sports TV"
                width={56}
                height={56}
                className="rounded-xl object-contain logo-brand-glow"
                style={{ background: "#fff", padding: 3, border: "1.5px solid rgba(245,166,35,0.4)" }}
              />
              {/* Live dot */}
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 animate-pulse"
                style={{ background: "var(--primary-accent)", borderColor: "var(--bg-card)" }}
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-[0.08em] leading-none brand-gradient-red">
                ABO SPORTS TV
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--primary-accent)" }} />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--primary-accent)" }}>LIVE STREAMING</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 transition hover:bg-white/10 md:hidden"
            style={{ color: "var(--text-muted)" }}
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-1 px-3 py-3">
          {/* ── Main Navigation ── */}
          <div className="mb-1">
            <p className="mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
              Navigation
            </p>
            <Link
              href="/"
              onClick={() => { setSidebarOpen(false); handleGlobalSportsClick(); }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
              style={{
                background: activeModule === "global_sports" ? "rgba(245,166,35,0.12)" : "transparent",
                color: activeModule === "global_sports" ? "var(--primary-accent)" : "var(--text-muted)",
                borderLeft: activeModule === "global_sports" ? "2px solid var(--primary-accent)" : "2px solid transparent",
              }}
            >
              <Home size={17} />
              🌍 Global Sports
              <CountBadge count={gsCount} />
            </Link>

            <button
              type="button"
              onClick={handleBangladeshClick}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
              style={{
                background: activeModule === "bangladesh" ? "rgba(0,106,78,0.15)" : "transparent",
                color: activeModule === "bangladesh" ? "#10b981" : "var(--text-muted)",
                borderLeft: activeModule === "bangladesh" ? "2px solid #10b981" : "2px solid transparent",
              }}
            >
              <Tv size={17} />
              🇧🇩 Bangladesh
              <CountBadge count={bdCount} />
            </button>

            <button
              type="button"
              onClick={handleIndiaClick}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
              style={{
                background: activeModule === "india" ? "rgba(99,102,241,0.12)" : "transparent",
                color: activeModule === "india" ? "rgb(199 210 254)" : "var(--text-muted)",
                borderLeft: activeModule === "india" ? "2px solid rgb(99 102 241)" : "2px solid transparent",
              }}
            >
              <Globe size={17} />
              🇮🇳 India
              <CountBadge count={inCount} />
            </button>

            <button
              type="button"
              onClick={handleFastTvClick}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
              style={{
                background: activeModule === "fast_tv" ? "rgba(245,166,35,0.12)" : "transparent",
                color: activeModule === "fast_tv" ? "var(--primary-accent)" : "var(--text-muted)",
                borderLeft: activeModule === "fast_tv" ? "2px solid var(--primary-accent)" : "2px solid transparent",
              }}
            >
              <Zap size={17} />
              ⚡ FAST TV (24/7)
              <CountBadge count={fastCount} />
            </button>

            <button
              type="button"
              onClick={handleLiveMatchesClick}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
              style={{
                background: activeModule === "live_matches" ? "rgba(229,57,53,0.12)" : "transparent",
                color: activeModule === "live_matches" ? "#FF5252" : "var(--text-muted)",
                borderLeft: activeModule === "live_matches" ? "2px solid rgba(229,57,53,0.5)" : "2px solid transparent",
              }}
            >
              <Flame size={17} />
              🔴 Live Matches
            </button>

            <button
              type="button"
              onClick={handleWorldCupClick}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
              style={{
                background: activeModule === "world_cup_2026" ? "rgba(245,166,35,0.15)" : "transparent",
                color: activeModule === "world_cup_2026" ? "var(--primary-accent)" : "var(--text-muted)",
                borderLeft: activeModule === "world_cup_2026" ? "2px solid var(--primary-accent)" : "2px solid transparent",
              }}
            >
              <Trophy size={17} />
              🏆 World Cup 2026
              <CountBadge count={wcCount} />
            </button>

          </div>

          {/* ── Sports Categories (global IPTV sports) ── */}
          <div className="mt-2">
            <p className="mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
              🏆 Sports Categories
            </p>
            <div className="flex flex-col gap-0.5">
              {activeModule !== "global_sports" ? (
                <p className="px-2 py-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Open <strong style={{ color: "var(--primary-accent)" }}>Global Sports</strong> to filter by sport type.
                </p>
              ) : null}
              {activeModule === "global_sports" ? visibleCats.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleCategoryClick(cat.key)}
                  className={`sports-cat-item${activeCategory === cat.key ? " active" : ""}`}
                >
                  <span className="text-base leading-none">{cat.emoji}</span>
                  <span className="text-sm">{cat.label}</span>
                </button>
              )) : null}
            </div>
          </div>

          <div
            className="mt-3 flex gap-2 rounded-lg px-3 py-2.5 text-[11px] leading-relaxed"
            style={{
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
              background: "var(--bg-card2)",
            }}
          >
            <Zap className="mt-0.5 shrink-0" size={14} style={{ color: "var(--primary-accent)" }} aria-hidden />
            <p className="m-0">{t("installHint")}</p>
          </div>
        </div>

        {/* ── Footer credit ── */}
        <div
          className="px-4 py-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Image
              src="/icons/abo-sports-tv-logo.png"
              alt="ABO Sports TV"
              width={28}
              height={28}
              className="rounded-lg object-contain bg-white shrink-0"
              style={{ border: "1px solid rgba(245,166,35,0.3)" }}
            />
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] leading-none brand-gradient-red">
                ABO SPORTS TV
              </p>
              <div className="mt-0.5 flex items-center gap-1">
                <span className="h-1 w-1 rounded-full" style={{ background: "var(--primary-accent)" }} />
                <span className="text-[8px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>LIVE STREAMING</span>
              </div>
            </div>
          </div>
          <p className="text-[9px] uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>
            Powered by
          </p>
          <a
            href="https://aboenterprise.netlify.app/"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-bold transition hover:opacity-80"
            style={{ color: "var(--primary-accent)" }}
          >
            ABO ENTERPRISE
          </a>
          <p className="mt-0.5 text-[9px]" style={{ color: "var(--text-muted)" }}>
            v{APP_META.version} · Build {APP_META.build}
          </p>
          <p className="mt-0.5 text-[9px]" style={{ color: "var(--text-muted)" }}>
            {APP_META.developer} · {APP_META.copyright}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-semibold">
            <a href={LEGAL_LINKS.privacy} target="_blank" rel="noreferrer" className="text-accent-gold hover:underline">Privacy</a>
            <a href={LEGAL_LINKS.terms} target="_blank" rel="noreferrer" className="text-accent-gold hover:underline">Terms</a>
          </div>
        </div>
      </aside>
    </>
  );
}

