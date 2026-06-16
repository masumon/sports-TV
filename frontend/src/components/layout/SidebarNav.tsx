"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/branding";
import { PRIMARY_NAV } from "@/lib/nav";
import { useUiStore } from "@/store/uiStore";

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const activeModule = useUiStore((s) => s.activeModule);
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus);
  const { gsCount, liveCount, wcCount, allCount } = useUiStore((s) => s.moduleCounts);

  const countMap: Record<string, number> = {
    world_cup_2026: wcCount,
    live_matches: liveCount,
    global_sports: gsCount,
    all_channels: allCount,
  };

  function navigate(item: (typeof PRIMARY_NAV)[number]) {
    setSidebarOpen(false);
    if (item.action === "search") {
      requestSearchFocus();
      return;
    }
    if (item.action === "module" && item.module) {
      setActiveModule(item.module);
      if (pathname !== "/") router.push("/");
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

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
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-glass-border px-4 py-4 lg:px-3 lg:group-hover/sidebar:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
              <Image src={BRAND.logo.png} alt={BRAND.name} width={40} height={40} className="object-contain" />
            </div>
            <div className="min-w-0 lg:opacity-0 lg:transition-opacity lg:group-hover/sidebar:opacity-100">
              <p className="truncate text-sm font-bold text-accent-gold">ABO SPORTS TV</p>
              <p className="text-[10px] text-foreground-muted">Live Streaming</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-foreground-muted transition hover:bg-surface-elevated lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Sidebar navigation">
          {PRIMARY_NAV.filter((item) => item.action !== "more").map((item) => {
            const isActive = item.action === "module" && pathname === "/" && activeModule === item.module;
            const Icon = item.icon;
            const count = item.module ? (countMap[item.module] ?? 0) : 0;
            const accentColor =
              item.module === "world_cup_2026" ? "#F5A623"
              : item.module === "live_matches" ? "#f87171"
              : item.module === "global_sports" ? "#34d399"
              : item.module === "all_channels" ? "#a78bfa"
              : "var(--text-muted)";

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold",
                  isActive
                    ? "bg-accent-gold/10"
                    : "text-foreground-secondary hover:bg-surface-elevated hover:text-foreground",
                )}
                style={{ color: isActive ? accentColor : undefined }}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" aria-hidden />
                <span className="flex min-w-0 flex-1 items-center justify-between truncate lg:opacity-0 lg:transition-opacity lg:group-hover/sidebar:opacity-100">
                  <span className="truncate">{item.label}</span>
                  {count > 0 && (
                    <span
                      className="ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums"
                      style={{ background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }}
                    >
                      {count > 9999 ? "9999+" : count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
