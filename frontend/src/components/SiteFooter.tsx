"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePlayerStore } from "@/store/playerStore";
import { BRAND } from "@/lib/branding";
import {
  ChevronDown,
  ExternalLink,
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

const SOCIAL_LINKS = [
  { icon: <Facebook size={15} />, label: "Facebook", href: "https://www.facebook.com/abo.enterprise", color: "#1877F2" },
  { icon: <Send size={15} />, label: "Telegram", href: "https://t.me/01825007977", color: "#2AABEE" },
  { icon: <MessageCircle size={15} />, label: "WhatsApp", href: "https://wa.me/8801825007977", color: "#25D366" },
  { icon: <Youtube size={15} />, label: "YouTube", href: "https://www.youtube.com/@aboenterprise", color: "#FF0000" },
] as const;

/** Uniform chip style for both Coverage and Product tags */
const chipStyle = (accent?: string) =>
  ({
    background: accent ? `${accent}12` : "rgba(255,255,255,0.05)",
    border: `1px solid ${accent ? `${accent}28` : "rgba(255,255,255,0.11)"}`,
    color: accent ?? "var(--text-muted)",
  }) as React.CSSProperties;

export function SiteFooter() {
  const activeChannel = usePlayerStore((s) => s.activeChannel);
  const [bdExpanded, setBdExpanded] = useState(true);

  return (
    <footer
      className={`mt-auto ${activeChannel ? "hidden md:block" : ""}`}
      style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border)" }}
    >
      {/* ── Brand hero: logo + name + badges only — no developer card ── */}
      <div
        className="relative overflow-hidden py-3.5 sm:py-5"
        style={{
          background: "linear-gradient(135deg, rgb(var(--primary-rgb)/0.07) 0%, rgb(var(--primary-rgb)/0.02) 100%)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 sm:gap-4">
          {/* Logo */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center sm:h-11 sm:w-11">
            <Image
              src={BRAND.logo.png}
              alt={BRAND.name}
              width={44}
              height={44}
              className="h-10 w-10 object-contain sm:h-11 sm:w-11"
            />
          </div>

          {/* Name + tagline + badges */}
          <div className="min-w-0 flex-1">
            <h2
              className="text-sm font-black uppercase leading-none tracking-[0.06em] sm:text-base"
              style={{
                background: "linear-gradient(90deg,#F5A623 0%,#fff 50%,#F5A623 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {BRAND.nameFull}
            </h2>
            <p className="mt-0.5 text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
              Global live sports &amp; Bangladesh TV — one app.
            </p>
            {/* Badge strip: flex-nowrap so it never wraps, scrolls on tiny viewports */}
            <div className="-mx-0.5 mt-1.5 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-0.5">
              <span className="live-badge inline-flex shrink-0 items-center gap-1 text-[8px]">
                <Radio size={8} className="animate-pulse" aria-hidden /> LIVE
              </span>
              <span
                className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={chipStyle("var(--primary-accent)")}
              >
                HLS · PWA · HD
              </span>
              <span
                className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={chipStyle("#10b981")}
              >
                10,000+ Channels
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile collapse toggle ── */}
      <div className="mx-auto w-full max-w-6xl px-4 py-1.5 sm:hidden">
        <button
          type="button"
          onClick={() => setBdExpanded(!bdExpanded)}
          className="flex w-full items-center justify-between rounded-xl px-3 py-1.5 transition"
          style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
        >
          <span className="text-[11px] font-bold" style={{ color: "var(--text-main)" }}>
            Features · Contact · Coverage
          </span>
          <ChevronDown
            size={14}
            aria-hidden
            style={{
              color: "var(--text-muted)",
              transform: bdExpanded ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform 150ms ease",
            }}
          />
        </button>
      </div>

      {/* ── Three-column grid — CSS collapse, no SSR flash ── */}
      <div
        className={`mx-auto w-full max-w-6xl px-4 py-4 sm:block sm:px-6 sm:py-5 lg:px-8 ${bdExpanded ? "block" : "hidden"}`}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">

          {/* Product */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Product
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              HLS player · backup streams · server relay · PWA. Tuned for mobile networks.
            </p>
            <div className="flex flex-wrap gap-1">
              {(["HLS", "PWA", "Multi-region", "HD"] as const).map((tag) => (
                <span key={tag} className="rounded-full px-2 py-0.5 text-[9px] font-semibold" style={chipStyle("var(--primary-accent)")}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Contact
            </p>
            {/* Social icon buttons */}
            <div className="flex items-center gap-1.5">
              {SOCIAL_LINKS.map(({ icon, label, href, color }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:scale-110 active:scale-95"
                  style={{ background: `${color}18`, border: `1px solid ${color}2e`, color }}
                >
                  {icon}
                </a>
              ))}
            </div>
            {/* Email + phone */}
            <div className="flex flex-col gap-0.5">
              <a
                href="mailto:contact@aboenterprise.com"
                className="flex items-center gap-1.5 text-[10px] font-medium transition hover:opacity-80"
                style={{ color: "var(--text-muted)" }}
              >
                <Mail size={11} style={{ color: "var(--primary-accent)", flexShrink: 0 }} aria-hidden />
                contact@aboenterprise.com
              </a>
              <a
                href="tel:+8801825007977"
                className="flex items-center gap-1.5 text-[10px] font-medium transition hover:opacity-80"
                style={{ color: "var(--text-muted)" }}
              >
                <Phone size={11} style={{ color: "#10b981", flexShrink: 0 }} aria-hidden />
                +880 1825-007977
              </a>
            </div>
          </div>

          {/* Coverage */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Coverage
            </p>
            <div className="flex flex-wrap gap-1">
              {(["⚽ Football", "🏏 Cricket", "🏀 Basketball", "🎾 Tennis", "🏎️ F1", "🥊 Boxing", "🏒 Hockey", "🏈 NFL"] as const).map((s) => (
                <span key={s} className="rounded-full px-2 py-0.5 text-[9px] font-medium" style={chipStyle()}>
                  {s}
                </span>
              ))}
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-[10px] font-semibold transition hover:opacity-80"
              style={{ color: "var(--primary-accent)" }}
            >
              <Star size={10} fill="currentColor" aria-hidden />
              Browse channels
            </Link>
          </div>
        </div>
      </div>

      {/* ── "Powered by ABO Enterprise" — subtle attribution near footer ── */}
      <div
        className="flex items-center justify-center py-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <a
          href={BRAND.developerWebsiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[10px] font-medium transition hover:opacity-75"
          style={{ color: "var(--text-muted)" }}
        >
          Powered by
          <span className="font-bold" style={{ color: "var(--primary-accent)" }}>
            {BRAND.developer}
          </span>
          <ExternalLink size={9} aria-hidden className="opacity-40" />
        </a>
      </div>

      {/* ── Legal + copyright — single compact row, no scroll needed ── */}
      <div className="px-4 py-2" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1">
          {/* Dot-separated legal links — no icons, guaranteed one-line fit */}
          <div className="flex flex-nowrap items-center text-[10px]" style={{ color: "var(--text-muted)" }}>
            <a href={LEGAL_PDF.privacy} target="_blank" rel="noopener noreferrer" className="transition hover:opacity-80">Privacy</a>
            <span aria-hidden className="mx-2 opacity-30">·</span>
            <a href={LEGAL_PDF.terms} target="_blank" rel="noopener noreferrer" className="transition hover:opacity-80">Terms</a>
            <span aria-hidden className="mx-2 opacity-30">·</span>
            <a href={LEGAL_PDF.license} target="_blank" rel="noopener noreferrer" className="transition hover:opacity-80">License</a>
            <span aria-hidden className="mx-2 opacity-30">·</span>
            <a href={LEGAL_PDF.international} target="_blank" rel="noopener noreferrer" className="transition hover:opacity-80">Intl. Use</a>
          </div>
          {/* Copyright */}
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            © {new Date().getFullYear()}{" "}
            <Link href="/" className="font-semibold hover:opacity-80" style={{ color: "var(--primary-accent)" }}>
              ABO Sports TV
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
