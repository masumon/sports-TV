"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePlayerStore } from "@/store/playerStore";
import { BRAND } from "@/lib/branding";
import { DeveloperBrandCard } from "@/components/branding/DeveloperBrandCard";
import {
  ChevronDown,
  ExternalLink,
  Mail,
  Phone,
  Shield,
  FileText,
  BookOpen,
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
  { icon: <Facebook size={16} />, label: "Facebook", href: "https://www.facebook.com/abo.enterprise", color: "#1877F2" },
  { icon: <Send size={16} />, label: "Telegram", href: "https://t.me/01825007977", color: "#2AABEE" },
  { icon: <MessageCircle size={16} />, label: "WhatsApp", href: "https://wa.me/8801825007977", color: "#25D366" },
  { icon: <Youtube size={16} />, label: "YouTube", href: "https://www.youtube.com/@aboenterprise", color: "#FF0000" },
] as const;

const COVERAGE_CHIPS = [
  "⚽ Football", "🏏 Cricket", "🏀 Basketball", "🎾 Tennis",
  "🏎️ Formula 1", "🥊 Boxing", "🏒 Hockey", "🏈 NFL",
] as const;

export function SiteFooter() {
  const activeChannel = usePlayerStore((s) => s.activeChannel);
  const [bdExpanded, setBdExpanded] = useState(true);

  return (
    <footer
      className={`mt-auto ${activeChannel ? "hidden md:block" : ""}`}
      style={{ background: "var(--bg-card)", borderTop: "1px solid var(--border)" }}
    >
      {/* Brand hero — compact on mobile */}
      <div
        className="relative overflow-hidden py-4 sm:py-7"
        style={{
          background: "linear-gradient(135deg, rgb(var(--primary-rgb)/0.07) 0%, rgb(var(--primary-rgb)/0.02) 100%)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 sm:gap-6">
          {/* Logo */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center sm:h-14 sm:w-14">
            <Image src={BRAND.logo.png} alt={BRAND.name} width={56} height={56} className="h-11 w-11 object-contain sm:h-14 sm:w-14" />
          </div>

          {/* Brand text + badges */}
          <div className="min-w-0 flex-1">
            <h2
              className="text-base font-black uppercase leading-tight tracking-[0.06em] sm:text-xl"
              style={{
                background: "linear-gradient(90deg,#F5A623 0%,#fff 50%,#F5A623 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {BRAND.nameFull}
            </h2>
            <p className="mt-0.5 text-[11px] leading-tight sm:text-sm" style={{ color: "var(--text-muted)" }}>
              Global live sports &amp; Bangladesh TV — one app.
            </p>
            {/* Badge strip — horizontal scroll on narrow screens */}
            <div className="-mx-0.5 mt-2 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-0.5 pb-0.5 sm:flex-wrap sm:gap-2">
              <span className="live-badge inline-flex shrink-0 items-center gap-1">
                <Radio size={9} className="animate-pulse" /> LIVE
              </span>
              <span
                className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)", color: "var(--primary-accent)" }}
              >
                HLS · PWA · HD
              </span>
              <span
                className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}
              >
                10,000+ Channels
              </span>
            </div>
          </div>

          {/* Developer card — desktop only */}
          <DeveloperBrandCard size="sm" className="hidden shrink-0 sm:inline-flex" />
        </div>

        {/* Developer card row — mobile only, centered below hero */}
        <div className="mt-3 flex justify-center sm:hidden">
          <DeveloperBrandCard size="sm" showLabel={false} />
        </div>
      </div>

      {/* Mobile collapse toggle */}
      <div className="mx-auto w-full max-w-6xl px-4 py-2 sm:hidden">
        <button
          type="button"
          onClick={() => setBdExpanded(!bdExpanded)}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2 transition"
          style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
        >
          <span className="text-xs font-bold" style={{ color: "var(--text-main)" }}>
            Features · Contact · Coverage
          </span>
          <ChevronDown
            size={15}
            style={{
              color: "var(--text-muted)",
              transform: bdExpanded ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform 150ms ease",
            }}
          />
        </button>
      </div>

      {/* Collapsible body — CSS-driven, no SSR flash */}
      <div className={`mx-auto w-full max-w-6xl px-4 py-5 sm:block sm:px-6 sm:py-8 lg:px-8 ${bdExpanded ? "block" : "hidden"}`}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">

          {/* Product */}
          <div className="space-y-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Product
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              HLS player · backup streams · server relay · PWA install. Tuned for mobile networks.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(["HLS", "PWA", "Multi-region", "HD"] as const).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={{ background: "rgb(var(--primary-rgb) / 0.08)", border: "1px solid var(--border-accent)", color: "var(--primary-accent)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Contact
            </p>
            {/* Social icon row */}
            <div className="flex items-center gap-2">
              {SOCIAL_LINKS.map(({ icon, label, href, color }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-xl transition hover:scale-110 active:scale-95"
                  style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}
                >
                  {icon}
                </a>
              ))}
            </div>
            {/* Email + Phone */}
            <div className="space-y-1">
              <a
                href="mailto:contact@aboenterprise.com"
                className="flex items-center gap-2 text-[11px] font-medium transition hover:opacity-80"
                style={{ color: "var(--text-muted)" }}
              >
                <Mail size={12} style={{ color: "var(--primary-accent)" }} />
                contact@aboenterprise.com
              </a>
              <a
                href="tel:+8801825007977"
                className="flex items-center gap-2 text-[11px] font-medium transition hover:opacity-80"
                style={{ color: "var(--text-muted)" }}
              >
                <Phone size={12} style={{ color: "#10b981" }} />
                +880 1825-007977
              </a>
            </div>
          </div>

          {/* Coverage */}
          <div className="space-y-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Coverage
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COVERAGE_CHIPS.map((s) => (
                <span
                  key={s}
                  className="rounded-full px-2.5 py-1 text-[10px] font-medium"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "var(--text-muted)",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold transition hover:opacity-80"
              style={{ color: "var(--primary-accent)" }}
            >
              <Star size={11} fill="currentColor" />
              Browse channels
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Legal links */}
          <div className="-mx-1 flex items-center gap-x-3 overflow-x-auto px-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {[
              { icon: <Shield size={10} />, label: "Privacy", href: LEGAL_PDF.privacy },
              { icon: <FileText size={10} />, label: "Terms", href: LEGAL_PDF.terms },
              { icon: <BookOpen size={10} />, label: "License", href: LEGAL_PDF.license },
              { icon: <FileText size={10} />, label: "International", href: LEGAL_PDF.international },
            ].map(({ icon, label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 transition hover:opacity-80"
              >
                {icon} {label}
                <ExternalLink size={8} className="opacity-40" />
              </a>
            ))}
          </div>
          {/* Copyright */}
          <p className="shrink-0 text-[11px] sm:text-right" style={{ color: "var(--text-muted)" }}>
            © {new Date().getFullYear()}{" "}
            <Link href="/" className="font-semibold hover:opacity-80" style={{ color: "var(--primary-accent)" }}>
              ABO Sports TV
            </Link>
            {" · "}
            <a href={BRAND.developerWebsiteUrl} target="_blank" rel="noopener noreferrer"
              className="hover:opacity-80 transition" style={{ color: "var(--primary-accent)" }}>
              {BRAND.developer}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
