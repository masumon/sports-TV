"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUiStore } from "@/store/uiStore";
import { useThemeAccentStore, THEME_ACCENTS } from "@/store/themeAccentStore";

type Props = {
  open: boolean;
  onClose: () => void;
};

const EXTRA_MODULES = [
  { id: "india",          label: "India",   emoji: "🇮🇳", color: "rgb(199,210,254)",  bg: "rgba(99,102,241,0.12)" },
  { id: "world_cup_2026", label: "WC 2026", emoji: "🏆", color: "#F5A623",           bg: "rgba(245,166,35,0.12)" },
  { id: "fast_tv",        label: "FAST TV", emoji: "⚡", color: "#F5A623",           bg: "rgba(245,166,35,0.10)" },
] as const;

export function MoreSheet({ open, onClose }: Props) {
  const router = useRouter();
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  const { accent, setAccent } = useThemeAccentStore();

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function navigateTo(moduleId: string) {
    setActiveModule(moduleId as Parameters<typeof setActiveModule>[0]);
    router.push("/");
    onClose();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60"
        style={{ backdropFilter: "blur(4px)" }}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-4 pb-8 pt-4"
        style={{
          background: "var(--bg-card2)",
          border: "1px solid var(--border)",
          borderBottom: "none",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
          paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Handle bar */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />

        {/* More modules */}
        <p className="mb-3 px-1 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          আরও মডিউল
        </p>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {EXTRA_MODULES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => navigateTo(m.id)}
              className="flex flex-col items-center gap-2 rounded-2xl py-4 transition active:scale-95"
              style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
            >
              <span className="text-2xl leading-none">{m.emoji}</span>
              <span className="text-[11px] font-bold" style={{ color: m.color }}>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Theme picker */}
        <p className="mb-3 px-1 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          থিম রং
        </p>
        <div className="flex gap-2.5 mb-5">
          {THEME_ACCENTS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setAccent(t.id)}
              title={t.desc}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-xl py-3 transition active:scale-95"
              style={{
                background: accent === t.id ? `${t.color}18` : "var(--bg-hover)",
                border: `1.5px solid ${accent === t.id ? t.color : "var(--border)"}`,
              }}
            >
              <span
                className="h-5 w-5 rounded-full"
                style={{ background: t.color, boxShadow: accent === t.id ? `0 0 8px ${t.color}88` : "none" }}
              />
              <span className="text-[9px] font-bold" style={{ color: accent === t.id ? t.color : "var(--text-muted)" }}>
                {t.label}
              </span>
            </button>
          ))}
        </div>

        {/* Admin link hidden from UI — direct URL /admin still accessible to admins */}
      </div>
    </>
  );
}
