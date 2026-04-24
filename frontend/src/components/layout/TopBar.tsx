"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Globe, Menu, Moon, Search, Sun, Tv, Sparkles, Shield } from "lucide-react";
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
    <header className="sticky top-0 z-40 backdrop-blur-md" style={{ background: "rgb(13 13 18 / 95%)", borderBottom: "1px solid rgb(255 255 255 / 8%)" }}>
      <div className="flex h-14 items-center gap-2 px-2 md:px-4">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg p-2 md:hidden"
          style={{ color: "var(--text-muted)" }}
          onClick={toggleSidebar}
          aria-label="Menu"
        >
          <Menu size={22} />
        </button>
        <div className="hidden items-center gap-2 md:flex">
          <Tv className="h-6 w-6" style={{ color: "var(--primary-accent)" }} />
          <span className="text-sm font-bold tracking-tight text-white">{t("appTitle")}</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            id="gstv-search"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("search")}
            className="w-full rounded-lg py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            style={{ background: "var(--bg-card)", border: "1px solid rgb(255 255 255 / 10%)" }}
          />
        </div>
        {tier === "premium" ? (
          <span className="hidden items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold sm:inline-flex" style={{ background: "rgb(251 191 36 / 15%)", border: "1px solid rgb(251 191 36 / 30%)", color: "#fbbf24" }}>
            <Sparkles size={12} /> {t("premium")}
          </span>
        ) : (
          <span className="hidden sm:inline text-[10px]" style={{ color: "var(--text-muted)" }}>{t("free")}</span>
        )}
        {mounted && (
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="rounded-lg p-2"
            style={{ color: "var(--text-muted)" }}
            aria-label="Theme"
          >
            {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => setLocale(locale === "en" ? "bn" : "en")}
          className="flex items-center gap-1 rounded-lg p-2"
          style={{ color: "var(--text-muted)" }}
          title="Language"
        >
          <Globe size={18} />
          <span className="text-xs font-medium uppercase">{locale}</span>
        </button>
        {user?.is_admin ? (
          <Link
            href="/admin/dashboard"
            className="hidden items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium sm:inline-flex"
            style={{ background: "rgb(0 200 81 / 10%)", border: "1px solid rgb(0 200 81 / 30%)", color: "#00c851" }}
          >
            <Shield size={14} />
            {t("admin")}
          </Link>
        ) : (
          <Link
            href="/admin/login"
            className="hidden text-xs underline-offset-2 hover:underline sm:inline"
            style={{ color: "var(--text-muted)" }}
          >
            {t("signIn")}
          </Link>
        )}
      </div>
    </header>
  );
}
