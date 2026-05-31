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
      className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch justify-around md:hidden"
      style={{
        height: "calc(3.5rem + env(safe-area-inset-bottom, 0px))",
        background: "var(--bg-glass)",
        borderTop: "1px solid var(--border)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "0 -2px 16px rgba(0,0,0,0.28)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
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
            className="flex flex-1 flex-col items-center justify-center gap-0.5 transition-all active:scale-95"
            style={{ color: active ? tab.activeColor : "var(--text-muted)" }}
          >
            <div
              className="flex h-7 w-11 items-center justify-center rounded-full transition-all"
              style={{ background: active ? tab.activeBg : "transparent" }}
            >
              <span className="text-[1.2rem] leading-none" aria-hidden>{tab.emoji}</span>
            </div>
            <span className="max-w-[3.5rem] truncate text-[10px] leading-none" style={{ fontWeight: active ? 700 : 500 }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
