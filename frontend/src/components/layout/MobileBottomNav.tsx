"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Globe, MoreHorizontal, Radio, Search, Tv2 } from "lucide-react";
import { useUiStore } from "@/store/uiStore";
import { MoreSheet } from "@/components/layout/MoreSheet";

/**
 * Mobile bottom navigation (hidden on md+).
 * 5 primary tabs + "More" sheet (India, WC 2026, FAST TV, Theme, Admin).
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const activeModule = useUiStore((s) => s.activeModule);
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus);
  const [moreOpen, setMoreOpen] = useState(false);

  const isHome = pathname === "/";

  function haptic() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(8);
    }
  }

  function navigate(module: string) {
    haptic();
    if (module === "more") {
      setMoreOpen(true);
      return;
    }
    if (module === "search") {
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
    setActiveModule(module as Parameters<typeof setActiveModule>[0]);
    if (pathname !== "/") {
      router.push("/");
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const tabs = [
    { id: "bangladesh", label: "বাংলাদেশ", Icon: Tv2, activeColor: "#10b981", activeBg: "rgba(16,185,129,0.15)", glow: "0 0 16px rgba(16,185,129,0.35)" },
    { id: "live_matches", label: "Live", Icon: Radio, activeColor: "#f87171", activeBg: "rgba(239,68,68,0.15)", glow: "0 0 16px rgba(239,68,68,0.35)" },
    { id: "global_sports", label: "Sports", Icon: Globe, activeColor: "var(--primary-accent)", activeBg: "rgb(var(--primary-rgb)/0.15)", glow: "0 0 16px var(--accent-gold-glow)" },
    { id: "search", label: "খুঁজুন", Icon: Search, activeColor: "#a78bfa", activeBg: "rgba(139,92,246,0.15)", glow: "0 0 16px rgba(139,92,246,0.35)" },
    { id: "more", label: "আরও", Icon: MoreHorizontal, activeColor: "var(--text-muted)", activeBg: "rgba(255,255,255,0.08)", glow: "none" },
  ] as const;

  return (
    <>
      <nav
        className="glass-premium fixed z-30 flex items-stretch justify-around md:hidden"
        style={{
          bottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
          left: "0.75rem",
          right: "0.75rem",
          minHeight: "3.75rem",
          borderRadius: "1.25rem",
        }}
      >
        {tabs.map((tab) => {
          const active = tab.id !== "more" && tab.id !== "search" && isHome && activeModule === tab.id;
          const isMore = tab.id === "more";
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              onClick={() => navigate(tab.id)}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 transition-all active:scale-90 px-2 py-3"
              style={{ color: active ? tab.activeColor : "var(--text-muted)", minHeight: "3.75rem" }}
            >
              <div
                className="flex items-center justify-center rounded-xl transition-all"
                style={{
                  width: "2.75rem",
                  height: "2rem",
                  background: active ? tab.activeBg : (isMore && moreOpen ? "rgba(255,255,255,0.08)" : "transparent"),
                  boxShadow: active ? tab.glow : "none",
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} aria-hidden />
              </div>
              <span
                className="max-w-[3.2rem] truncate text-[8px] leading-none tracking-wide font-bengali"
                style={{ fontWeight: active ? 800 : 500 }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
