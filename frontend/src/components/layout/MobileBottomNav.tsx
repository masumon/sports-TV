"use client";

import { usePathname, useRouter } from "next/navigation";
import { useUiStore } from "@/store/uiStore";

/**
 * Mobile bottom navigation (hidden on md+).
 * 5 tabs: Global Sports · Live Matches · FAST TV · Bangladesh · India
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const activeModule = useUiStore((s) => s.activeModule);
  const setActiveModule = useUiStore((s) => s.setActiveModule);

  const isHome = pathname === "/";

  function navigate(module: string) {
    setActiveModule(module as Parameters<typeof setActiveModule>[0]);
    if (pathname !== "/") {
      router.push("/");
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const tabs = [
    { id: "bangladesh",     label: "বাংলাদেশ",  emoji: "🇧🇩", activeColor: "#10b981",               activeBg: "rgba(16,185,129,0.12)" },
    { id: "live_matches",   label: "Live",     emoji: "🔴", activeColor: "#f87171",               activeBg: "rgba(239,68,68,0.12)" },
    { id: "world_cup_2026", label: "World Cup", emoji: "🏆", activeColor: "#F5A623",               activeBg: "rgba(245,166,35,0.15)" },
    { id: "global_sports",  label: "Sports",   emoji: "🌍", activeColor: "var(--primary-accent)", activeBg: "rgba(229,9,20,0.12)" },
    { id: "india",          label: "India",    emoji: "🇮🇳", activeColor: "rgb(199,210,254)",       activeBg: "rgba(99,102,241,0.15)" },
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
              className="flex h-8 w-12 items-center justify-center rounded-xl transition-all"
              style={{ background: active ? tab.activeBg : "transparent" }}
            >
              <span className="text-[1.25rem] leading-none" aria-hidden>{tab.emoji}</span>
            </div>
            <span className="max-w-[3.5rem] truncate text-[9px] leading-none tracking-wide" style={{ fontWeight: active ? 800 : 500 }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
