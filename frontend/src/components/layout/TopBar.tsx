"use client";

import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Globe, Menu, Moon, Search, Sun, Sparkles, Shield, Radio, X } from "lucide-react";
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
      className="sticky top-0 z-40"
      style={{
        background: "rgba(11,15,25,0.96)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 1px 24px rgba(0,0,0,0.4)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {/* Mobile: tighter gap; Desktop: normal gap */}
      <div className="flex min-h-14 items-center gap-1 px-2 sm:gap-2 md:min-h-16 md:px-4">

        {/* Mobile menu button */}
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center rounded-lg p-2 transition hover:bg-white/10 md:hidden"
          style={{ color: "var(--text-muted)" }}
          onClick={toggleSidebar}
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>

        {/* Logo */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl sm:h-9 sm:w-9 md:h-10 md:w-10"
            style={{ background: "#fff", border: "1.5px solid rgba(245,166,35,0.45)", boxShadow: "0 2px 12px rgba(245,166,35,0.2)" }}
          >
            <Image
              src="/icons/abo-sports-tv-logo.png"
              alt="ABO Sports TV"
              width={32}
              height={32}
              className="object-contain"
              style={{ padding: 2 }}
            />
          </div>
          {/* Brand text — hidden on small screens to save space */}
          <div className="hidden min-[420px]:flex flex-col">
            <p className="text-[10px] font-black uppercase tracking-[0.06em] leading-none sm:text-[11px]" style={{ color: "#F5A623" }}>
              ABO SPORTS
            </p>
            <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "#ef4444" }}>
              ● LIVE
            </span>
          </div>
        </div>

        {/* Search bar — takes all remaining space */}
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-1.5">
          <div className="relative min-w-0 flex-1" ref={searchWrapRef}>
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 sm:h-4 sm:w-4 sm:left-3"
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
              spellCheck={false}
              className="search-input min-h-11 w-full rounded-xl py-2.5 pl-8 pr-7 placeholder:opacity-60 focus:outline-none sm:pl-9 sm:pr-8 md:min-h-10 md:py-2"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => { onSearch(""); setShowSuggestions(false); document.getElementById("gstv-search")?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 transition hover:bg-white/10"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={13} />
              </button>
            )}
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

          {/* Search Go button — icon only on mobile */}
          <button
            type="button"
            onClick={commitSearchNavigation}
            className="shrink-0 rounded-xl p-2.5 sm:px-3 sm:py-2 text-sm font-semibold transition hover:opacity-90 min-h-11 md:min-h-10"
            style={{ background: "var(--primary-accent)", color: "#0a0a0f" }}
            aria-label={t("searchGo")}
          >
            <Search size={15} aria-hidden />
          </button>
        </div>

        {/* LIVE badge — desktop only (player has its own LIVE badge on mobile) */}
        <div
          role="status"
          aria-label="Live HLS"
          className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
          style={{ background: "rgba(229,57,53,0.12)", border: "1px solid rgba(229,57,53,0.3)", color: "#FF5252" }}
        >
          <Radio size={10} className="shrink-0 animate-pulse" aria-hidden />
          LIVE
        </div>

        {/* Premium badge — icon only on mobile */}
        {tier === "premium" && (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-1 sm:gap-1 sm:px-2.5 sm:py-1"
            style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", color: "var(--primary-accent)" }}
            title={t("premium")}
          >
            <Sparkles size={11} className="shrink-0" />
            <span className="hidden sm:inline text-[10px] font-bold">{t("premium")}</span>
          </span>
        )}

        {/* Theme toggle — desktop only */}
        {mounted && (
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="hidden sm:inline-flex items-center justify-center rounded-lg p-2 transition hover:bg-white/10"
            style={{ color: "var(--text-muted)" }}
            aria-label="Toggle theme"
          >
            {resolvedTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        )}

        {/* Language toggle — globe icon only on mobile, text on sm+ */}
        <button
          type="button"
          onClick={() => setLocale(locale === "en" ? "bn" : "en")}
          className="flex shrink-0 items-center justify-center gap-1 rounded-lg p-2 sm:px-2 sm:py-1.5 transition hover:bg-white/10"
          style={{ color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
          title="Language / ভাষা"
          aria-label="Toggle language"
        >
          <Globe size={15} />
          <span className="hidden sm:inline text-xs font-semibold">{locale.toUpperCase()}</span>
        </button>

        {/* Admin link — desktop only */}
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


