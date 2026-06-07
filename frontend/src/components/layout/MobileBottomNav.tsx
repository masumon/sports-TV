"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
    { id: "bangladesh",   label: "বাংলাদেশ", emoji: "🇧🇩", activeColor: "#10b981", activeBg: "rgba(16,185,129,0.12)" },
    { id: "live_matches", label: "Live",    emoji: "🔴", activeColor: "#f87171", activeBg: "rgba(239,68,68,0.12)" },
    { id: "global_sports",label: "Sports",  emoji: "🌍", activeColor: "var(--primary-accent)", activeBg: "rgb(var(--primary-rgb)/0.12)" },
    { id: "search",       label: "খুঁজুন",  emoji: "🔍", activeColor: "#a78bfa", activeBg: "rgba(139,92,246,0.12)" },
    { id: "more",         label: "আরও",    emoji: "⋯",  activeColor: "var(--text-muted)", activeBg: "rgba(255,255,255,0.08)" },
  ] as const;

  return (
    <>
      <nav
        className="fixed z-30 flex items-stretch justify-around md:hidden"
        style={{
          bottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
          left: "0.75rem",
          right: "0.75rem",
          minHeight: "3.75rem",
          background: "rgba(8,11,18,0.92)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "1.25rem",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {tabs.map((tab) => {
          const active = tab.id !== "more" && tab.id !== "search" && isHome && activeModule === tab.id;
          const isMore = tab.id === "more";
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
                }}
              >
                <span className={`leading-none ${isMore ? "text-lg font-black" : "text-xl"}`} aria-hidden>
                  {tab.emoji}
                </span>
              </div>
              <span
                className="max-w-[3.2rem] truncate text-[8px] leading-none tracking-wide"
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
