"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/LocaleContext";
import { cn } from "@/lib/cn";
import { isNavActive, PRIMARY_NAV } from "@/lib/nav";

export function BottomNav() {
  const pathname = usePathname();
  const { locale } = useI18n();

  return (
    <nav
      className="fixed inset-x-3 bottom-0 z-30 flex items-stretch justify-around rounded-2xl border border-glass-border bg-surface-secondary/90 backdrop-blur-xl shadow-glass md:hidden"
      style={{ marginBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
      aria-label="Primary navigation"
    >
      {PRIMARY_NAV.map((item) => {
        const active = isNavActive(pathname, item);
        const Icon = item.icon;
        const label = locale === "bn" ? item.labelBn : item.label;

        return (
          <Link
            key={item.id}
            href={item.href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "interactive-transition flex min-h-[3.75rem] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 active:scale-95",
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
            <span className={cn("max-w-[4rem] truncate text-[9px] tracking-wide", active ? "font-bold" : "font-medium")}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
