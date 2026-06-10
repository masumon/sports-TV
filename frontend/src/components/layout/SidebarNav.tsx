"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n/LocaleContext";
import { cn } from "@/lib/cn";
import { isNavActive, PRIMARY_NAV } from "@/lib/nav";
import { useUiStore } from "@/store/uiStore";

export function SidebarNav() {
  const pathname = usePathname();
  const { locale } = useI18n();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] transition-opacity lg:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />

      <aside
        className={cn(
          "group/sidebar fixed left-0 top-0 z-40 flex h-full flex-col border-r border-glass-border bg-surface-secondary/95 backdrop-blur-xl transition-all duration-300 ease-in-out lg:static lg:translate-x-0",
          "w-64 lg:w-[4.5rem] lg:hover:w-56",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-glass-border px-4 py-4 lg:px-3 lg:group-hover/sidebar:px-4">
          <Link href="/" className="flex min-w-0 items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-accent-gold/40 bg-white">
              <Image src="/icons/abo-sports-tv-logo.png" alt="ABO Sports TV" width={36} height={36} className="object-contain p-0.5" />
            </div>
            <div className="min-w-0 lg:opacity-0 lg:transition-opacity lg:group-hover/sidebar:opacity-100">
              <p className="truncate text-sm font-bold text-accent-gold">ABO SPORTS TV</p>
              <p className="text-[10px] text-foreground-muted">Live Streaming</p>
            </div>
          </Link>
          <button
            type="button"
            className="rounded-lg p-1.5 text-foreground-muted transition hover:bg-surface-elevated lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Sidebar navigation">
          {PRIMARY_NAV.filter((item) => item.href).map((item) => {
            const active = isNavActive(pathname, item);
            const Icon = item.icon;
            const label = locale === "bn" ? item.labelBn : item.label;

            return (
              <Link
                key={item.id}
                href={item.href!}
                onClick={() => setSidebarOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold",
                  active
                    ? "glow-gold bg-accent-gold/10 text-accent-gold"
                    : "text-foreground-secondary hover:bg-surface-elevated hover:text-foreground",
                )}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} className="shrink-0" aria-hidden />
                <span className="truncate lg:opacity-0 lg:transition-opacity lg:group-hover/sidebar:opacity-100">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
