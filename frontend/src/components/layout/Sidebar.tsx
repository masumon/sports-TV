"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, LucideIcon, Settings, Sparkles, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/LocaleContext";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

const items: { href: Route; key: string; icon: LucideIcon }[] = [
  { href: "/", key: "home", icon: Home },
  { href: "/#gstv-search" as Route, key: "browse", icon: LayoutGrid },
  { href: "/admin/login", key: "admin", icon: Settings },
];

export function Sidebar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const { sidebarOpen, setSidebarOpen } = useUiStore();

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity md:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />
      <aside
        className={`fixed left-0 top-0 z-40 flex h-full w-64 flex-col p-4 transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } shrink-0`}
        style={{ background: "var(--bg-card)", borderRight: "1px solid rgb(255 255 255 / 7%)" }}
      >
        <div className="mb-6 flex items-center justify-between gap-2 md:justify-center">
          <div className="md:hidden" />
          <div className="flex items-center gap-2">
            <span className="text-lg font-black tracking-wider" style={{ color: "var(--primary-accent)" }}>G</span>
            <p className="text-xs font-bold uppercase tracking-widest text-white">SPORTS TV</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 md:hidden"
            style={{ color: "var(--text-muted)" }}
            onClick={() => setSidebarOpen(false)}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((item) => {
            if (item.key === "admin") {
              const to = (user?.is_admin ? "/admin/dashboard" : "/admin/login") as Route;
              const active = pathname?.startsWith("/admin");
              return (
                <Link
                  key={item.key}
                  href={to}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors"
                  style={{
                    background: active ? "rgb(229 9 20 / 15%)" : "transparent",
                    color: active ? "#fff" : "var(--text-muted)",
                  }}
                >
                  <item.icon size={18} />
                  {t("admin")}
                </Link>
              );
            }
            const active = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors"
                style={{
                  background: active ? "rgb(229 9 20 / 15%)" : "transparent",
                  color: active ? "#fff" : "var(--text-muted)",
                  borderLeft: active ? "3px solid var(--primary-accent)" : "3px solid transparent",
                }}
              >
                <item.icon size={18} />
                {t(item.key as "home" | "browse")}
              </Link>
            );
          })}
        </nav>
        <a
          href="https://mumainsumon.netlify.app/"
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center gap-2 text-xs hover:text-slate-300"
          style={{ color: "var(--text-muted)" }}
        >
          <Sparkles size={12} />
          Dev credits
        </a>
      </aside>
    </>
  );
}
