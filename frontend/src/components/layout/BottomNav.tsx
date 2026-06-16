"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { MoreSheet } from "@/components/layout/MoreSheet";
import { cn } from "@/lib/cn";
import { PRIMARY_NAV } from "@/lib/nav";
import { useUiStore } from "@/store/uiStore";

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus);
  const activeModule = useUiStore((s) => s.activeModule);
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  const { gsCount, liveCount, wcCount, allCount } = useUiStore((s) => s.moduleCounts);
  const [moreOpen, setMoreOpen] = useState(false);

  const countMap: Record<string, number> = {
    world_cup_2026: wcCount,
    live_matches: liveCount,
    global_sports: gsCount,
    all_channels: allCount,
  };

  function haptic() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
  }

  function navigate(item: (typeof PRIMARY_NAV)[number]) {
    haptic();
    if (item.action === "search") {
      if (pathname !== "/") {
        try { sessionStorage.setItem("gstv-focus-search", "1"); } catch { /* */ }
        router.push("/");
      } else {
        requestSearchFocus();
        queueMicrotask(() => {
          document.getElementById("gstv-search")?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
      return;
    }
    if (item.action === "more") { setMoreOpen(true); return; }
    if (item.action === "module" && item.module) {
      setActiveModule(item.module);
      if (pathname !== "/") router.push("/");
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <>
      <nav
        className="fixed inset-x-3 bottom-0 z-30 flex items-stretch justify-around rounded-2xl border border-glass-border bg-surface-secondary/90 backdrop-blur-xl shadow-glass md:hidden"
        style={{ marginBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
        aria-label="Primary navigation"
      >
        {PRIMARY_NAV.map((item) => {
          const isActive = item.action === "module" && pathname === "/" && activeModule === item.module;
          const isMaybeMore = item.action === "more";
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
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              aria-expanded={isMaybeMore ? moreOpen : undefined}
              onClick={() => navigate(item)}
              className={cn(
                "interactive-transition flex min-h-[3.75rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 active:scale-95",
                isActive ? "" : "text-foreground-muted",
              )}
              style={{ color: isActive ? accentColor : (isMaybeMore && moreOpen ? "var(--primary-accent)" : undefined) }}
            >
              <span
                className="relative flex h-8 w-11 items-center justify-center rounded-xl transition-all duration-200"
                style={{
                  background: isActive ? `${accentColor}22` : (isMaybeMore && moreOpen ? "rgba(245,166,35,0.12)" : "transparent"),
                  boxShadow: isActive ? `0 0 14px ${accentColor}44` : "none",
                  outline: isActive ? `1.5px solid ${accentColor}66` : "none",
                  outlineOffset: 1,
                }}
              >
                <Icon size={20} strokeWidth={isActive ? 2.75 : 2} aria-hidden />
                {count > 0 && (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[8px] font-black tabular-nums"
                    style={{ background: accentColor, color: "#0a0a0f" }}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              <span className={cn("max-w-[3.5rem] truncate text-[8px] tracking-wide", isActive ? "font-extrabold" : "font-medium")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
