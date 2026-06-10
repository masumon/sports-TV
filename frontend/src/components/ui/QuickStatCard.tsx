"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type QuickStatCardProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  accent?: "gold" | "red" | "cyan" | "muted";
  onClick?: () => void;
  active?: boolean;
  className?: string;
};

const accentStyles = {
  gold: { color: "var(--primary-accent)", bg: "rgba(245,197,24,0.1)", border: "rgba(245,197,24,0.35)" },
  red: { color: "#f87171", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)" },
  cyan: { color: "var(--accent-cyan)", bg: "rgba(34,211,238,0.1)", border: "rgba(34,211,238,0.3)" },
  muted: { color: "var(--text-muted)", bg: "var(--bg-card)", border: "var(--border)" },
};

export function QuickStatCard({ label, value, icon, accent = "gold", onClick, active, className }: QuickStatCardProps) {
  const style = accentStyles[accent];
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "glass-premium flex flex-col items-start gap-1 rounded-2xl p-4 text-left transition-all duration-200",
        onClick && "active:scale-[0.98] hover:border-accent-gold/30",
        active && "ring-1 ring-accent-gold/40",
        className,
      )}
      style={{
        background: active ? style.bg : undefined,
        borderColor: active ? style.border : undefined,
      }}
    >
      <div className="flex w-full items-center justify-between gap-2">
        {icon ? <span className="opacity-80" style={{ color: style.color }}>{icon}</span> : null}
        <span className="ml-auto text-2xl font-black tabular-nums" style={{ color: style.color }}>
          {value}
        </span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
    </Tag>
  );
}
