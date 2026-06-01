"use client";

import { usePathname, useRouter } from "next/navigation";
import { useUiStore } from "@/store/uiStore";

/**
 * Mobile bottom navigation (hidden on md+).
 * Tabs: Bangladesh · Live · WC 2026 · Sports · Search · India
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const activeModule = useUiStore((s) => s.activeModule);
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus);

  const isHome = pathname === "/";

  function haptic() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(8);
    }
  }

  function navigate(module: string) {
    haptic();
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
    { id: "bangladesh",     label: "বাংলাদেশ", emoji: "🇧🇩", activeColor: "#10b981",               activeBg: "rgba(16,185,129,0.12)" },
    { id: "live_matches",   label: "Live",    emoji: "🔴", activeColor: "#f87171",               activeBg: "rgba(239,68,68,0.12)" },
    { id: "world_cup_2026", label: "WC 2026", emoji: "🏆", activeColor: "#F5A623",               activeBg: "rgba(245,166,35,0.15)" },
    { id: "global_sports",  label: "Sports",  emoji: "🌍", activeColor: "var(--primary-accent)", activeBg: "rgba(229,9,20,0.12)" },
    { id: "search",         label: "খুঁজুন",   emoji: "🔍", activeColor: "#a78bfa",               activeBg: "rgba(139,92,246,0.12)" },
    { id: "india",          label: "India",   emoji: "🇮🇳", activeColor: "rgb(199,210,254)",       activeBg: "rgba(99,102,241,0.15)" },
  ] as const;

  return (
    <nav
      className="fixed z-30 flex items-stretch justify-around md:hidden"
      style={{
        bottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
        left: "0.75rem",
        right: "0.75rem",
        height: "3.75rem",
        background: "rgba(11,15,25,0.88)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "1.25rem",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.03)",
      }}
    >
      {tabs.map((tab) => {
        const active = isHome && activeModule === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-label={tab.label}
            aria-current={active ? "page" : undefined}
            onClick={() => navigate(tab.id)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 transition-all active:scale-90"
            style={{ color: active ? tab.activeColor : "var(--text-muted)" }}
          >
            <div
              className="flex h-7 w-9 items-center justify-center rounded-lg transition-all min-[375px]:h-8 min-[375px]:w-10 min-[400px]:w-12 min-[400px]:rounded-xl"
              style={{ background: active ? tab.activeBg : "transparent" }}
            >
              <span className="text-[1.1rem] leading-none min-[375px]:text-[1.2rem]" aria-hidden>{tab.emoji}</span>
            </div>
            <span className="max-w-[2.8rem] truncate text-[8px] leading-none tracking-wide min-[375px]:max-w-[3.2rem] min-[375px]:text-[9px]" style={{ fontWeight: active ? 800 : 500 }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
