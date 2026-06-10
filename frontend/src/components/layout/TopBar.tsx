"use client";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Globe, Menu, Moon, Search, Sparkles, Sun, User, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/LocaleContext";
import { flagFromCountryName } from "@/components/channel/flagEmoji";
import { Badge } from "@/components/ui/Badge";
import { useAuthStore } from "@/store/authStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import { useUiStore } from "@/store/uiStore";
import { SearchOverlay } from "@/components/SearchOverlay";
import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/branding";
import type { Channel } from "@/lib/types";

const RECENT_SEARCHES_KEY = "gstv-recent-searches";
const MAX_RECENT_SEARCHES = 5;

type TopBarProps = {
  onSearch: (q: string) => void;
  searchQuery: string;
};

export function TopBar({ onSearch, searchQuery }: TopBarProps) {
  const { t, locale, setLocale } = useI18n();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const tier = useSubscriptionStore((s) => s.tier);
  const { toggleSidebar } = useUiStore();
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus);
  const searchFocusNonce = useUiStore((s) => s.searchFocusNonce);
  const searchSuggestions = useUiStore((s) => s.searchSuggestions);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {
      /* keep empty */
    }
  }, []);

  const saveRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    try {
      const updated = [trimmed, ...recentSearches.filter((s) => s !== trimmed)].slice(0, MAX_RECENT_SEARCHES);
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      /* continue */
    }
  };

  const clearRecentSearches = () => {
    try {
      setRecentSearches([]);
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      /* continue */
    }
  };

  const commitSearchNavigation = () => {
    const q = searchQuery.trim();
    if (q) {
      saveRecentSearch(q);
    }
    onSearch(q);
    setShowSuggestions(false);
    setSearchOverlayOpen(false);
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/", { scroll: false });
  };

  const openMobileSearch = () => {
    setSearchOverlayOpen(true);
  };

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
    if (window.innerWidth < 768) {
      setSearchOverlayOpen(true);
      return;
    }
    document.getElementById("gstv-search")?.focus({ preventScroll: true });
  }, [searchFocusNonce]);

  useEffect(() => {
    if (pathname !== "/") return;
    try {
      if (sessionStorage.getItem("gstv-focus-search") === "1") {
        sessionStorage.removeItem("gstv-focus-search");
        requestSearchFocus();
        if (window.innerWidth < 768) {
          setSearchOverlayOpen(true);
        } else {
          queueMicrotask(() => {
            document.getElementById("gstv-search")?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        }
      }
    } catch {
      /* */
    }
  }, [pathname, requestSearchFocus]);

  const profileInitial = user?.full_name?.trim().charAt(0).toUpperCase() ?? null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface-secondary/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-3 sm:gap-3 md:h-16 md:px-4">
          {/* Left: menu + brand */}
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-foreground-muted transition hover:bg-surface-elevated hover:text-foreground md:hidden"
            onClick={toggleSidebar}
            aria-label="Menu"
          >
            <Menu size={20} />
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-90">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full sm:h-10 sm:w-10">
              <Image
                src={BRAND.logo.png}
                alt={BRAND.name}
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <div className="hidden min-[380px]:flex flex-col leading-none">
              <span className="text-sm font-bold tracking-wide text-accent-gold sm:text-base">
                ABO SPORTS TV
              </span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground-muted sm:text-[10px]">
                Live Streaming
              </span>
            </div>
          </Link>

          {/* Center: desktop search */}
          <div className="hidden min-w-0 flex-1 items-center justify-center md:flex md:px-4">
            <div className="relative w-full max-w-xl" ref={searchWrapRef}>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted"
                aria-hidden
              />
              <input
                id="gstv-search"
                value={searchQuery}
                onChange={(e) => {
                  onSearch(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (searchSuggestions.length) {
                    setShowSuggestions(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitSearchNavigation();
                  }
                  if (e.key === "Escape") {
                    setShowSuggestions(false);
                  }
                }}
                placeholder={t("search")}
                aria-label={t("search")}
                inputMode="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="search-input h-11 w-full rounded-xl border border-accent-gold/40 bg-accent-gold/5 py-2 pl-10 pr-9 text-sm text-foreground shadow-glow-gold placeholder:text-foreground-muted focus:border-accent-gold/60 focus:outline-none focus:ring-2 focus:ring-accent-gold/35"
              />
              {searchQuery ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    onSearch("");
                    setShowSuggestions(false);
                    document.getElementById("gstv-search")?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-foreground-muted transition hover:bg-surface-secondary hover:text-foreground"
                >
                  <X size={14} />
                </button>
              ) : null}

              {showSuggestions && searchSuggestions.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-glass-border bg-surface-secondary shadow-glass">
                  {searchSuggestions.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onSearch(ch.name);
                        saveRecentSearch(ch.name);
                        setShowSuggestions(false);
                        router.push(`/?q=${encodeURIComponent(ch.name)}`, { scroll: false });
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-elevated"
                    >
                      {ch.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ch.logo_url}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-md border border-glass-border object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-xs font-bold text-accent-gold">
                          {ch.name.slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{ch.name}</p>
                        <p className="truncate text-[10px] text-foreground-muted">
                          {flagFromCountryName(ch.country)} {ch.country} · {ch.quality_tag.toUpperCase()}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Right: actions */}
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
            {tier === "premium" ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-accent-gold/30 bg-accent-gold/10 px-2 py-1 text-accent-gold"
                title={t("premium")}
              >
                <Sparkles size={11} className="shrink-0" aria-hidden />
                <span className="hidden text-[10px] font-bold sm:inline">{t("premium")}</span>
              </span>
            ) : null}

            <div className="hidden lg:block">
              <Badge variant="live">LIVE</Badge>
            </div>

            {mounted ? (
              <button
                type="button"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="hidden h-10 w-10 items-center justify-center rounded-xl text-foreground-muted transition hover:bg-surface-elevated hover:text-foreground sm:inline-flex"
                aria-label="Toggle theme"
              >
                {resolvedTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "bn" : "en")}
              className="hidden h-10 items-center justify-center gap-1 rounded-xl border border-glass-border px-2.5 text-foreground-muted transition hover:bg-surface-elevated hover:text-foreground sm:inline-flex"
              title="Language / ভাষা"
              aria-label="Toggle language"
            >
              <Globe size={15} aria-hidden />
              <span className="text-xs font-semibold">{locale.toUpperCase()}</span>
            </button>

            <button
              type="button"
              onClick={openMobileSearch}
              className="inline-flex h-10 min-w-[2.5rem] items-center justify-center gap-1 rounded-xl border border-accent-gold/35 bg-accent-gold/10 px-2.5 text-accent-gold shadow-glow-gold transition hover:bg-accent-gold/15 md:hidden"
              aria-label={t("search")}
            >
              <Search size={18} strokeWidth={2.25} />
              <span className="text-[10px] font-bold uppercase tracking-wide">Search</span>
            </button>

            <Link
              href="/profile"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-glass-border transition",
                "text-foreground-muted hover:bg-surface-elevated hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              )}
              aria-label="Profile"
              title={user?.full_name ?? "Profile"}
            >
              {profileInitial ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-gold/15 text-xs font-bold text-accent-gold">
                  {profileInitial}
                </span>
              ) : (
                <User size={18} />
              )}
            </Link>
          </div>
        </div>
      </header>

      <SearchOverlay
        isOpen={searchOverlayOpen}
        onClose={() => setSearchOverlayOpen(false)}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          onSearch(q);
        }}
        suggestions={searchSuggestions as Channel[]}
        onSuggestionClick={(ch) => {
          onSearch(ch.name);
          saveRecentSearch(ch.name);
          setSearchOverlayOpen(false);
          router.push(`/?q=${encodeURIComponent(ch.name)}`, { scroll: false });
        }}
        recentSearches={recentSearches}
        onRecentClick={(query) => {
          onSearch(query);
          setSearchOverlayOpen(false);
          router.push(`/?q=${encodeURIComponent(query)}`, { scroll: false });
        }}
        onClearRecent={clearRecentSearches}
      />
    </>
  );
}
