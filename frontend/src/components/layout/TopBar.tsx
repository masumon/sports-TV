"use client";

import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Globe, Menu, Moon, Search, Sun, Sparkles, Shield, Radio, User } from "lucide-react";
import { usePathname } from "next/navigation";
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
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus);
  const searchFocusNonce = useUiStore((s) => s.searchFocusNonce);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (searchFocusNonce === 0) return;
    document.getElementById("gstv-search")?.focus({ preventScroll: true });
  }, [searchFocusNonce]);

  // After router.push("/") from bottom nav "Search" on admin/offline etc.
  useEffect(() => {
    if (pathname !== "/") return;
    try {
      if (sessionStorage.getItem("gstv-focus-search") === "1") {
        sessionStorage.removeItem("gstv-focus-search");
        requestSearchFocus();
        queueMicrotask(() => {
          document.getElementById("gstv-search")?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
    } catch {
      /* */
    }
  }, [pathname, requestSearchFocus]);

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-xl"
      style={{
        background: "rgba(7,8,15,0.94)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 1px 20px rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex min-h-14 items-center gap-1.5 px-2 sm:gap-2 md:min-h-16 md:gap-2 md:px-4">
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
            inputMode="search"
            autoComplete="off"
            autoCorrect="off"
            className="search-input min-h-11 w-full rounded-xl py-2.5 pl-9 pr-3 text-[15px] text-white placeholder:text-slate-500 focus:outline-none sm:text-sm md:min-h-10 md:py-2"
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          />
        </div>

        {/* Live badge */}
        <div className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[10px]" style={{ background: "rgba(229,57,53,0.12)", border: "1px solid rgba(229,57,53,0.3)", color: "#FF5252" }}>
          <Radio size={11} className="shrink-0 animate-pulse" />
          <span className="hidden min-[400px]:inline sm:inline">LIVE</span>
        </div>

        {/* Premium badge */}
        {tier === "premium" ? (
          <span className="inline-flex max-w-[7rem] shrink-0 items-center gap-0.5 overflow-hidden text-ellipsis rounded-full px-1.5 py-0.5 text-[9px] font-bold sm:max-w-none sm:gap-1 sm:px-2.5 sm:py-1 sm:text-[10px]" style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", color: "var(--primary-accent)" }} title={t("premium")}>
            <Sparkles size={11} className="shrink-0" /> <span className="min-w-0 truncate sm:whitespace-nowrap">{t("premium")}</span>
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
            className="hidden min-h-10 min-w-[2.5rem] items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold md:inline-flex"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981" }}
            aria-label={t("admin")}
            title={t("admin")}
          >
            <Shield size={15} className="shrink-0" />
            <span className="hidden lg:inline">{t("admin")}</span>
          </Link>
        ) : (
          <Link
            href="/admin/login"
            className="hidden min-h-10 min-w-[2.5rem] items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition hover:bg-white/10 md:inline-flex"
            style={{ color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
            aria-label={t("signIn")}
            title={t("signIn")}
          >
            <User size={15} className="shrink-0" />
            <span className="hidden lg:inline">{t("signIn")}</span>
          </Link>
        )}
      </div>
    </header>
  );
}


