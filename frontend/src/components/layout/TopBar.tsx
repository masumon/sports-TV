"use client";

import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Globe, Menu, Moon, Search, Sun, Sparkles, Shield, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/LocaleContext";
import { useAuthStore } from "@/store/authStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import { useUiStore } from "@/store/uiStore";

type TopBarProps = {
  onSearch: (q: string) => void;
  searchQuery: string;
};

export function TopBar({ onSearch, searchQuery }: TopBarProps) {
  const { t, locale, setLocale } = useI18n();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const user = useAuthStore((s) => s.user);
  const tier = useSubscriptionStore((s) => s.tier);
  const { toggleSidebar } = useUiStore();

  useEffect(() => setMounted(true), []);

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-xl"
      style={{
        background: "rgba(7,8,15,0.94)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 1px 20px rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex h-14 items-center gap-2 px-2 md:px-4">
        {/* Mobile menu button */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg p-2 transition hover:bg-white/10 md:hidden"
          style={{ color: "var(--text-muted)" }}
          onClick={toggleSidebar}
          aria-label="Menu"
        >
          <Menu size={22} />
        </button>

        {/* Logo — hidden on mobile (sidebar has it) */}
        <div className="hidden items-center gap-2.5 md:flex shrink-0">
          <div className="relative h-8 w-8">
            <Image src="/icons/abo-logo.svg" alt="ABO" width={32} height={32} className="rounded-md" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.1em] leading-tight" style={{ color: "var(--primary-accent)" }}>
              ABO SPORTS TV
            </p>
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--accent-red)" }} />
              <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent-red)" }}>
                LIVE
              </span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative min-w-0 flex-1 mx-1 md:mx-2">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            id="gstv-search"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("search")}
            className="w-full rounded-xl py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2"
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(255,255,255,0.09)",
              focusRingColor: "var(--primary-accent)",
            }}
          />
        </div>

        {/* Live badge */}
        <div className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold sm:inline-flex" style={{ background: "rgba(229,57,53,0.12)", border: "1px solid rgba(229,57,53,0.3)", color: "#FF5252" }}>
          <Radio size={11} className="animate-pulse" /> LIVE
        </div>

        {/* Premium badge */}
        {tier === "premium" ? (
          <span className="hidden items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold sm:inline-flex" style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", color: "var(--primary-accent)" }}>
            <Sparkles size={11} /> {t("premium")}
          </span>
        ) : null}

        {/* Theme toggle */}
        {mounted && (
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="rounded-lg p-2 transition hover:bg-white/10"
            style={{ color: "var(--text-muted)" }}
            aria-label="Toggle theme"
          >
            {resolvedTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        )}

        {/* Language toggle */}
        <button
          type="button"
          onClick={() => setLocale(locale === "en" ? "bn" : "en")}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition hover:bg-white/10"
          style={{ color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
          title="Language"
        >
          <Globe size={14} />
          {locale.toUpperCase()}
        </button>

        {/* Admin / Sign-in */}
        {user?.is_admin ? (
          <Link
            href="/admin/dashboard"
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold sm:inline-flex transition"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981" }}
          >
            <Shield size={13} />
            {t("admin")}
          </Link>
        ) : (
          <Link
            href="/admin/login"
            className="hidden rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:bg-white/10 sm:inline-flex"
            style={{ color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {t("signIn")}
          </Link>
        )}
      </div>
    </header>
  );
}


