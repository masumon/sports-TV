"use client";

import Image from "next/image";
import Link from "next/link";
import { usePlayerStore } from "@/store/playerStore";
import { BRAND } from "@/lib/branding";
import {
  Mail,
  Phone,
  Youtube,
  Facebook,
  Send,
  MessageCircle,
  Radio,
  Star,
} from "lucide-react";

const LEGAL_PDF = {
  privacy: "/legal/abo-sports-tv-privacy-policy.pdf",
  terms: "/legal/abo-sports-tv-terms-of-service.pdf",
  license: "/legal/abo-sports-tv-license.pdf",
  international: "/legal/abo-sports-tv-international-use.pdf",
} as const;

const QUICK_ACTIONS = [
  { icon: <Facebook size={17} />, label: "Facebook",  href: "https://www.facebook.com/abo.enterprise",  color: "#1877F2", external: true  },
  { icon: <Send    size={17} />, label: "Telegram",  href: "https://t.me/01825007977",                 color: "#2AABEE", external: true  },
  { icon: <MessageCircle size={17} />, label: "WhatsApp", href: "https://wa.me/8801825007977",         color: "#25D366", external: true  },
  { icon: <Youtube size={17} />, label: "YouTube",   href: "https://www.youtube.com/@aboenterprise",  color: "#FF0000", external: true  },
  { icon: <Mail    size={17} />, label: "Email us",  href: "mailto:contact@aboenterprise.com",         color: "#F5A623", external: false },
  { icon: <Phone   size={17} />, label: "Call us",   href: "tel:+8801825007977",                       color: "#10b981", external: false },
] as const;

const COVERAGE = ["⚽", "🏏", "🎾", "🏀"] as const;

const chip = (accent?: string): React.CSSProperties => ({
  background: accent ? `${accent}12` : "rgba(255,255,255,0.05)",
  border:     `1px solid ${accent ? `${accent}28` : "rgba(255,255,255,0.11)"}`,
  color:      accent ?? "var(--text-muted)",
});

export function SiteFooter() {
  const activeChannel = usePlayerStore((s) => s.activeChannel);

  return (
    <footer
      className={`mt-auto ${activeChannel ? "hidden md:block" : ""}`}
      style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border)" }}
    >
      {/* ── 1. Brand Area ── */}
      <div
        className="px-4 py-3 sm:px-6"
        style={{
          background:   "linear-gradient(135deg, rgb(var(--primary-rgb)/0.07) 0%, rgb(var(--primary-rgb)/0.02) 100%)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          <Image
            src={BRAND.logo.png}
            alt={BRAND.name}
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 object-contain"
          />
          <div className="min-w-0 flex-1">
            <h2
              className="text-sm font-black uppercase leading-none tracking-[0.06em]"
              style={{
                background:          "linear-gradient(90deg,#F5A623 0%,#fff 60%,#F5A623 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor:  "transparent",
                backgroundClip:       "text",
              }}
            >
              {BRAND.nameFull}
            </h2>
            <div className="mt-1 flex flex-nowrap items-center gap-1.5 overflow-x-auto">
              <span className="live-badge inline-flex shrink-0 items-center gap-1 text-[8px]">
                <Radio size={8} className="animate-pulse" aria-hidden /> LIVE
              </span>
              <span
                className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={chip("#10b981")}
              >
                10,000+ Channels
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Quick Actions — icon-only, no raw contact info ── */}
      <div
        className="px-4 py-2.5 sm:px-6"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between sm:justify-start sm:gap-2">
          {QUICK_ACTIONS.map(({ icon, label, href, color, external }) => (
            <a
              key={label}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              aria-label={label}
              title={label}
              className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:scale-110 active:scale-95"
              style={{
                background: `${color}15`,
                border:     `1px solid ${color}30`,
                color,
              }}
            >
              {icon}
            </a>
          ))}
        </div>
      </div>

      {/* ── 3+4. Coverage Chips + Browse CTA (single row) ── */}
      <div
        className="px-4 py-2 sm:px-6"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            {COVERAGE.map((s) => (
              <span
                key={s}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-base"
                style={chip()}
              >
                {s}
              </span>
            ))}
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold transition hover:opacity-80"
            style={{ color: "var(--primary-accent)" }}
          >
            <Star size={10} fill="currentColor" aria-hidden />
            Browse Channels →
          </Link>
        </div>
      </div>

      {/* ── 5. Legal · 6. Powered By ── */}
      <div className="px-4 py-2 sm:px-6" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div
            className="flex flex-nowrap items-center text-[10px]"
            style={{ color: "var(--text-muted)" }}
          >
            <a href={LEGAL_PDF.privacy} target="_blank" rel="noopener noreferrer" className="transition hover:opacity-80">Privacy</a>
            <span aria-hidden className="mx-1.5 opacity-30">•</span>
            <a href={LEGAL_PDF.terms}   target="_blank" rel="noopener noreferrer" className="transition hover:opacity-80">Terms</a>
            <span aria-hidden className="mx-1.5 opacity-30">•</span>
            <a href={LEGAL_PDF.license} target="_blank" rel="noopener noreferrer" className="transition hover:opacity-80">License</a>
          </div>
          <a
            href={BRAND.developerWebsiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold transition hover:opacity-75"
            style={{ color: "var(--primary-accent)" }}
          >
            {BRAND.developer}
          </a>
        </div>
      </div>
    </footer>
  );
}
