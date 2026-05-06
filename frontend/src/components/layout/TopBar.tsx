"use client";

import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Globe, Menu, Moon, Search, Sun, Sparkles, Shield, Radio } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/LocaleContext";
import { flagFromCountryName } from "@/components/channel/flagEmoji";
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const tier = useSubscriptionStore((s) => s.tier);
  const { toggleSidebar } = useUiStore();
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus);
  const searchFocusNonce = useUiStore((s) => s.searchFocusNonce);
  const searchSuggestions = useUiStore((s) => s.searchSuggestions);
  const pathname = usePathname();
  const router = useRouter();

  const commitSearchNavigation = () => {
    const q = searchQuery.trim();
    onSearch(q);
    setShowSuggestions(false);
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/", { scroll: false });
  };

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{
        background: "rgba(7,8,15,0.92)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 1px 12px rgba(0,0,0,0.28)",
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

        {/* Logo — shown on all screen sizes */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative h-9 w-9 md:h-11 md:w-11">
            <Image
              src="/icons/original-logo.jpeg"
              alt="ABO Sports TV"
              width={44}
              height={44}
              className="rounded-xl object-contain logo-brand-glow"
              style={{ border: "1.5px solid rgba(229,9,20,0.35)" }}
            />
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 animate-pulse"
              style={{ background: "var(--primary-accent)", borderColor: "var(--bg-card)" }}
              aria-hidden
            />
          </div>
          <div className="hidden sm:block">
            <p className="text-[12px] font-black uppercase tracking-[0.08em] leading-none brand-gradient-red">
              ABO SPORTS TV
            </p>
            <div className="mt-0.5 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--accent-red)" }} />
              <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--accent-red)" }}>
                LIVE
              </span>
            </div>
          </div>
        </div>

        {/* Search + Go */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 mx-1 md:mx-2">
          <div className="relative min-w-0 flex-1" ref={searchWrapRef}>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              id="gstv-search"
              value={searchQuery}
              onChange={(e) => { onSearch(e.target.value); setShowSuggestions(true); }}
              onFocus={() => { if (searchSuggestions.length) setShowSuggestions(true); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitSearchNavigation(); }
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              placeholder={t("search")}
              aria-label={t("search")}
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              className="search-input min-h-11 w-full rounded-xl py-2.5 pl-9 pr-3 text-[15px] placeholder:opacity-70 focus:outline-none sm:text-sm md:min-h-10 md:py-2"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-main)",
              }}
            />
            {/* Suggestions dropdown */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl shadow-2xl"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                {searchSuggestions.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSearch(ch.name);
                      setShowSuggestions(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
                  >
                    {ch.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ch.logo_url} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" style={{ border: "1px solid var(--border)" }} loading="lazy" />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold" style={{ background: "var(--bg-hover)", color: "var(--primary-accent)" }}>
                        {ch.name.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: "var(--text-main)" }}>{ch.name}</p>
                      <p className="truncate text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {flagFromCountryName(ch.country)} {ch.country} · {ch.quality_tag.toUpperCase()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={commitSearchNavigation}
            className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition hover:opacity-90 min-h-11 md:min-h-10"
            style={{
              background: "var(--primary-accent)",
              color: "#0a0a0f",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            aria-label={t("searchGo")}
          >
            {t("searchGo")}
          </button>
        </div>

        {/* Live badge */}
        <div
          role="status"
          aria-label="Live HLS"
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[10px]"
          style={{ background: "rgba(229,57,53,0.12)", border: "1px solid rgba(229,57,53,0.3)", color: "#FF5252" }}
        >
          <Radio size={11} className="shrink-0 animate-pulse" aria-hidden />
          <span className="hidden min-[400px]:inline">LIVE</span>
        </div>

        {/* Network & Clock — removed (was fake/misleading) */}

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
        {user?.is_admin && (
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
        )}
      </div>
    </header>
  );
}


