"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { MoreSheet } from "@/components/layout/MoreSheet";
import { useI18n } from "@/lib/i18n/LocaleContext";
import { cn } from "@/lib/cn";
import { isNavActive, PRIMARY_NAV } from "@/lib/nav";
import { useUiStore } from "@/store/uiStore";

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useI18n();
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus);
  const [moreOpen, setMoreOpen] = useState(false);

  function openSearch() {
    if (pathname !== "/") {
      try {
        sessionStorage.setItem("gstv-focus-search", "1");
      } catch {
        /* */
      }
      router.push("/");
      return;
    }
    requestSearchFocus();
    queueMicrotask(() => {
      document.getElementById("gstv-search")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  return (
    <>
      <nav
        className="fixed inset-x-3 bottom-0 z-30 flex items-stretch justify-around rounded-2xl border border-glass-border bg-surface-secondary/90 backdrop-blur-xl shadow-glass md:hidden"
        style={{ marginBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
        aria-label="Primary navigation"
      >
        {PRIMARY_NAV.map((item) => {
          const active = isNavActive(pathname, item);
          const Icon = item.icon;
          const label = locale === "bn" ? item.labelBn : item.label;

          if (item.action === "search") {
            return (
              <button
                key={item.id}
                type="button"
                aria-label={label}
                onClick={openSearch}
                className={cn(
                  "interactive-transition flex min-h-[3.75rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 active:scale-95",
                  "text-foreground-muted",
                )}
              >
                <span className="flex h-8 w-11 items-center justify-center rounded-xl bg-transparent">
                  <Icon size={20} strokeWidth={2} aria-hidden />
                </span>
                <span className="max-w-[3.5rem] truncate text-[9px] font-medium tracking-wide">{label}</span>
              </button>
            );
          }

          if (item.action === "more") {
            return (
              <button
                key={item.id}
                type="button"
                aria-label={label}
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen(true)}
                className={cn(
                  "interactive-transition flex min-h-[3.75rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 active:scale-95",
                  moreOpen ? "text-accent-gold" : "text-foreground-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-11 items-center justify-center rounded-xl transition-all duration-200",
                    moreOpen ? "bg-accent-gold/12" : "bg-transparent",
                  )}
                >
                  <Icon size={20} strokeWidth={moreOpen ? 2.5 : 2} aria-hidden />
                </span>
                <span className={cn("max-w-[3.5rem] truncate text-[9px] tracking-wide", moreOpen ? "font-bold" : "font-medium")}>
                  {label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href!}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "interactive-transition flex min-h-[3.75rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 active:scale-95",
                active ? "text-accent-gold" : "text-foreground-muted",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-11 items-center justify-center rounded-xl transition-all duration-200",
                  active ? "bg-accent-gold/12" : "bg-transparent",
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} aria-hidden />
              </span>
              <span className={cn("max-w-[3.5rem] truncate text-[9px] tracking-wide", active ? "font-bold" : "font-medium")}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
