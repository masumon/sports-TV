"use client";

import type { Route } from "next";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home, LayoutGrid, Settings, X, Tv, Globe, ChevronDown, ChevronUp,
  Zap, Star, Flame, Activity,
} from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/LocaleContext";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

const SPORTS_CATEGORIES = [
  { label: "Football", emoji: "⚽", key: "football" },
  { label: "Cricket", emoji: "🏏", key: "cricket" },
  { label: "Basketball", emoji: "🏀", key: "basketball" },
  { label: "Tennis", emoji: "🎾", key: "tennis" },
  { label: "Baseball", emoji: "⚾", key: "baseball" },
  { label: "Rugby", emoji: "🏉", key: "rugby" },
  { label: "Hockey", emoji: "🏒", key: "hockey" },
  { label: "Golf", emoji: "⛳", key: "golf" },
  { label: "Boxing / MMA / UFC", emoji: "🥊", key: "boxing" },
  { label: "Formula 1", emoji: "🏎️", key: "racing" },
  { label: "Cycling", emoji: "🚴", key: "cycling" },
  { label: "Swimming", emoji: "🏊", key: "swimming" },
  { label: "Athletics", emoji: "🏃", key: "athletics" },
  { label: "Volleyball", emoji: "🏐", key: "volleyball" },
  { label: "Table Tennis", emoji: "🏓", key: "table-tennis" },
  { label: "Badminton", emoji: "🏸", key: "badminton" },
  { label: "Snooker", emoji: "🎱", key: "snooker" },
  { label: "Darts", emoji: "🎯", key: "darts" },
  { label: "Wrestling", emoji: "🤼", key: "wrestling" },
];

export function Sidebar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus);
  const activeModule = useUiStore((s) => s.activeModule);
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  const activeCategory = useUiStore((s) => s.activeCategory);
  const setActiveCategory = useUiStore((s) => s.setActiveCategory);
  const [showAllCats, setShowAllCats] = useState(false);

  const visibleCats = showAllCats ? SPORTS_CATEGORIES : SPORTS_CATEGORIES.slice(0, 8);

  function handleCategoryClick(key: string) {
    if (activeModule !== "sports") setActiveModule("sports");
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

  function handleSportsTVClick() {
    setActiveModule("sports");
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity md:hidden ${
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
          background: "var(--bg-card)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          scrollbarWidth: "none",
        }}
      >
        {/* ── Logo / Brand ── */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4 py-4"
          style={{
            background: "var(--bg-card)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative h-9 w-9 shrink-0">
              <Image src="/icons/abo-logo.svg" alt="ABO" width={36} height={36} className="rounded-lg" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] leading-none" style={{ color: "var(--primary-accent)" }}>
                ABO SPORTS
              </p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] leading-tight" style={{ color: "var(--text-muted)" }}>
                TV LIVE
              </p>
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
              onClick={() => { setSidebarOpen(false); handleSportsTVClick(); }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
              style={{
                background: activeModule === "sports" ? "rgba(245,166,35,0.12)" : "transparent",
                color: activeModule === "sports" ? "var(--primary-accent)" : "var(--text-muted)",
                borderLeft: activeModule === "sports" ? "2px solid var(--primary-accent)" : "2px solid transparent",
              }}
            >
              <Home size={17} />
              {t("home")} — 🌍 Sports TV
            </Link>

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
              🇮🇳 India TV
            </button>

            {/* Bangladesh TV */}
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
              🇧🇩 Bangladesh TV
            </button>

            {/* Browse / Search */}
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                requestSearchFocus();
                document.getElementById("channel-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
              style={{ color: "var(--text-muted)", borderLeft: "2px solid transparent" }}
            >
              <LayoutGrid size={17} />
              {t("browse")}
            </button>

            {/* Admin link */}
            <Link
              href={(user?.is_admin ? "/admin/dashboard" : "/admin/login") as Route}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
              style={{
                background: pathname?.startsWith("/admin") ? "rgba(245,166,35,0.12)" : "transparent",
                color: pathname?.startsWith("/admin") ? "var(--primary-accent)" : "var(--text-muted)",
                borderLeft: pathname?.startsWith("/admin") ? "2px solid var(--primary-accent)" : "2px solid transparent",
              }}
            >
              <Settings size={17} />
              {t("admin")}
            </Link>
          </div>

          {/* ── Sports Categories ── */}
          <div className="mt-2">
            <p className="mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
              🏆 Sports Categories
            </p>
            <div className="flex flex-col gap-0.5">
              {visibleCats.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleCategoryClick(cat.key)}
                  className={`sports-cat-item${activeCategory === cat.key ? " active" : ""}`}
                >
                  <span className="text-base leading-none">{cat.emoji}</span>
                  <span className="text-sm">{cat.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium transition hover:bg-white/5"
              style={{ color: "var(--text-muted)" }}
              onClick={() => setShowAllCats((v) => !v)}
            >
              {showAllCats ? (
                <><ChevronUp size={13} /> Show less</>
              ) : (
                <><ChevronDown size={13} /> {SPORTS_CATEGORIES.length - 8} more sports</>
              )}
            </button>
          </div>

          {/* ── Features ── */}
          <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(245,166,35,0.05)", border: "1px solid rgba(245,166,35,0.12)" }}>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--primary-accent)" }}>
              Platform Features
            </p>
            {[
              { icon: <Zap size={12} />, label: "HLS live streaming" },
              { icon: <Activity size={12} />, label: "Backup & relay streams" },
              { icon: <Globe size={12} />, label: "Sports, India & BD" },
              { icon: <Star size={12} />, label: "Quality selector" },
              { icon: <Flame size={12} />, label: "Large channel catalog" },
              { icon: <Tv size={12} />, label: "PWA install" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2 py-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                <span style={{ color: "var(--primary-accent)" }}>{icon}</span>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer credit ── */}
        <div
          className="px-4 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
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
            SUMONIX AI · © 2026
          </p>
        </div>
      </aside>
    </>
  );
}

