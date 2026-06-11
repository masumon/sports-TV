"use client";

import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { BRAND } from "@/lib/branding";

type Props = {
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
};

const SIZES = {
  sm: { logoW: 72, logoH: 28, pad: "px-3 py-2.5", label: "text-[8px]" },
  md: { logoW: 96, logoH: 36, pad: "px-4 py-3", label: "text-[9px]" },
  lg: { logoW: 120, logoH: 44, pad: "px-5 py-4", label: "text-[10px]" },
} as const;

/** Clickable glassmorphism developer card — opens developer website (no separate Globe button). */
export function DeveloperBrandCard({ size = "md", className = "", showLabel = true }: Props) {
  const s = SIZES[size];

  return (
    <a
      href={BRAND.developerWebsiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${BRAND.developer} — Developer website`}
      title={BRAND.developerWebsiteUrl.replace(/^https?:\/\//, "")}
      className={`group inline-flex flex-col items-center gap-2 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] ${s.pad} ${className}`}
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
      }}
    >
      {showLabel ? (
        <span
          className={`${s.label} font-bold uppercase tracking-[0.2em]`}
          style={{ color: "var(--text-muted, rgba(255,255,255,0.55))" }}
        >
          Powered by
        </span>
      ) : null}
      <Image
        src={BRAND.logo.enterprise}
        alt={BRAND.developer}
        width={s.logoW}
        height={s.logoH}
        className="object-contain transition group-hover:brightness-110"
      />
      <span
        className="flex items-center gap-1 text-[9px] font-semibold opacity-0 transition group-hover:opacity-100"
        style={{ color: "var(--primary-accent, #F5A623)" }}
      >
        Visit developer <ExternalLink size={10} aria-hidden />
      </span>
    </a>
  );
}
