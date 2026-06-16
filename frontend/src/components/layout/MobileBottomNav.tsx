"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Globe, MoreHorizontal, Radio, Search, Trophy } from "lucide-react";
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
  const [swipeHintDismissed, setSwipeHintDismissed] = useState(true);

  const isHome = pathname === "/";

  useEffect(() => {
    try {
      if (!localStorage.getItem("gstv-swipe-hint-seen")) {
        setSwipeHintDismissed(false);
      }
    } catch { /* ignore */ }
  }, []);

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
    { id: "world_cup_2026", label: "WC 2026", Icon: Trophy, activeColor: "#F5A623", activeBg: "rgba(245,166,35,0.15)", glow: "0 0 16px rgba(245,166,35,0.35)" },
    { id: "live_matches", label: "Live", Icon: Radio, activeColor: "#f87171", activeBg: "rgba(239,68,68,0.15)", glow: "0 0 16px rgba(239,68,68,0.35)" },
    { id: "global_sports", label: "Sports", Icon: Globe, activeColor: "var(--primary-accent)", activeBg: "rgb(var(--primary-rgb)/0.15)", glow: "0 0 16px var(--accent-gold-glow)" },
    { id: "search", label: "খুঁজুন", Icon: Search, activeColor: "#a78bfa", activeBg: "rgba(139,92,246,0.15)", glow: "0 0 16px rgba(139,92,246,0.35)" },
    { id: "more", label: "আরও", Icon: MoreHorizontal, activeColor: "var(--text-muted)", activeBg: "rgba(255,255,255,0.08)", glow: "none" },
  ] as const;

  return (
    <>
      {/* First-visit swipe hint */}
      {!swipeHintDismissed && isHome && (
        <div
          className="fixed z-29 md:hidden flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[10px]"
          style={{
            bottom: "max(5.25rem, calc(env(safe-area-inset-bottom, 0.75rem) + 4.5rem))",
            left: "0.75rem",
            right: "0.75rem",
            background: "rgba(8,11,18,0.88)",
            border: "1px solid rgba(245,166,35,0.3)",
            backdropFilter: "blur(16px)",
          }}
        >
          <span style={{ color: "rgba(245,166,35,0.9)" }}>👆 বাম/ডানে সোয়াইপ করে মডিউল পরিবর্তন করুন</span>
          <button
            type="button"
            onClick={() => {
              setSwipeHintDismissed(true);
              try { localStorage.setItem("gstv-swipe-hint-seen", "1"); } catch { /* */ }
            }}
            className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold transition hover:opacity-80"
            style={{ background: "rgba(245,166,35,0.15)", color: "rgba(245,166,35,0.9)" }}
          >
            ✓ বুঝেছি
          </button>
        </div>
      )}
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
                  outline: active ? `1.5px solid ${tab.activeColor}` : "none",
                  outlineOffset: active ? 1 : 0,
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.75 : 2} aria-hidden />
              </div>
              <span
                className="max-w-[3.2rem] truncate text-[8px] leading-none tracking-wide font-bengali"
                style={{ fontWeight: active ? 900 : 500 }}
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
