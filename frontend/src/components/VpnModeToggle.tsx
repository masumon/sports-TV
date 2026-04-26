"use client";

import { Shield, ShieldCheck, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/LocaleContext";
import { useVpnStore, type VpnMode } from "@/store/vpnStore";

const STYLES: Record<
  VpnMode,
  { icon: typeof Shield; border: string; bg: string; color: string; glow: string }
> = {
  on: {
    icon: ShieldCheck,
    border: "rgba(16,185,129,0.5)",
    bg: "rgba(16,185,129,0.12)",
    color: "#34d399",
    glow: "0 0 20px rgba(16,185,129,0.25)",
  },
  smart: {
    icon: Sparkles,
    border: "rgba(245,166,35,0.45)",
    bg: "rgba(245,166,35,0.1)",
    color: "var(--primary-accent)",
    glow: "0 0 16px rgba(245,166,35,0.2)",
  },
  off: {
    icon: Shield,
    border: "rgba(255,255,255,0.12)",
    bg: "rgba(255,255,255,0.04)",
    color: "var(--text-muted)",
    glow: "none",
  },
};

export function VpnModeToggle() {
  const { t } = useI18n();
  const mode = useVpnStore((s) => s.mode);
  const cycleMode = useVpnStore((s) => s.cycleMode);
  const s = STYLES[mode];
  const Icon = s.icon;

  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0">
      <button
        type="button"
        onClick={() => cycleMode()}
        className="relative flex h-10 min-w-10 sm:min-w-0 sm:pl-1.5 sm:pr-2.5 items-center justify-center gap-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wide transition active:scale-[0.98] sm:py-1.5"
        style={{
          borderColor: s.border,
          background: s.bg,
          color: s.color,
          boxShadow: s.glow,
        }}
        title={t("vpnTitle")}
        aria-label={t("vpnAria")}
      >
        <Icon size={18} className="shrink-0" strokeWidth={2.2} aria-hidden />
        <span className="hidden min-[500px]:inline max-w-[5.5rem] truncate sm:max-w-none">
          {mode === "on" ? t("vpnOn") : mode === "smart" ? t("vpnSmart") : t("vpnOff")}
        </span>
      </button>
      <span className="text-[7px] font-semibold uppercase tracking-wider hidden sm:block max-w-[4.5rem] text-center leading-tight" style={{ color: "var(--text-muted)" }}>
        {t("vpnShort")}
      </span>
    </div>
  );
}
