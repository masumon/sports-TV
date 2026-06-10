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
  Tv,
  Star,
} from "lucide-react";

const LEGAL_PDF = {
  privacy: "/legal/abo-sports-tv-privacy-policy.pdf",
  terms: "/legal/abo-sports-tv-terms-of-service.pdf",
  license: "/legal/abo-sports-tv-license.pdf",
  international: "/legal/abo-sports-tv-international-use.pdf",
} as const;

export function SiteFooter() {
  const activeChannel = usePlayerStore((s) => s.activeChannel);
  const [bdExpanded, setBdExpanded] = useState(true);

  return (
    <footer
      className={`mt-auto ${activeChannel ? "hidden md:block" : ""}`}
      style={{
        background: "var(--bg-card)",
        borderTop: "1px solid var(--border)",
      }}
    >
      {/* Brand header */}
      <div
        className="relative overflow-hidden py-8"
        style={{
          background: "linear-gradient(135deg, rgb(var(--primary-rgb)/0.05) 0%, rgb(var(--primary-rgb)/0.02) 100%)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 sm:flex-row sm:gap-8 sm:text-left">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center">
            <Image
              src={BRAND.logo.png}
              alt={BRAND.name}
              width={64}
              height={64}
              className="object-contain"
            />
          </div>

          {/* Brand identity */}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2
              className="text-xl font-black uppercase tracking-[0.06em] leading-tight sm:text-2xl"
              style={{
                background: "linear-gradient(90deg,#F5A623 0%,#fff 50%,#F5A623 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {BRAND.nameFull}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Global live sports, India &amp; Bangladesh TV — one app.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="live-badge inline-flex items-center gap-1">
                <Radio size={9} className="animate-pulse" /> LIVE
              </span>
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)", color: "var(--primary-accent)" }}>
                HLS · PWA · HD
              </span>
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}>
                10,000+ Channels
              </span>
            </div>
          </div>

          <DeveloperBrandCard size="md" className="shrink-0" />
        </div>
      </div>

      {/* Mobile collapsible header */}
      <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:hidden">
        <button
          type="button"
          onClick={() => setBdExpanded(!bdExpanded)}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2 transition"
          style={{ background: "var(--bg-hover)", border: "1px solid var(--border)" }}
        >
          <span className="text-xs font-bold" style={{ color: "var(--text-main)" }}>
            বাংলাদেশ / সংযোগ
          </span>
          <ChevronDown
            size={16}
            style={{
              color: "var(--text-muted)",
              transform: bdExpanded ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform 150ms ease",
            }}
          />
        </button>
      </div>

      {/* Footer content grid — collapsible on mobile */}
      <div
        className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 transition-all"
        style={{
          display: bdExpanded || typeof window === "undefined" || window.innerWidth >= 640 ? "block" : "none",
        }}
      >
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Product
            </p>
            <div className="flex items-center gap-2">
              <Tv size={14} style={{ color: "var(--primary-accent)" }} />
              <span className="text-xs font-bold tracking-wide" style={{ color: "var(--text-main)" }}>
                Live streaming
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              HLS player, backup streams, server relay for tricky sources, PWA install. Tuned for mobile networks.
            </p>
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {["HLS", "PWA", "Multi-region", "HD"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-2.5 py-1"
                  style={{ background: "rgb(var(--primary-rgb) / 0.08)", border: "1px solid var(--border-accent)", color: "var(--primary-accent)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Contact
            </p>
            <div className="space-y-1.5">
              {[
                { icon: <Facebook size={14} />, label: "Facebook", href: "https://www.facebook.com/abo.enterprise", color: "#1877F2" },
                { icon: <Send size={14} />, label: "Telegram", href: "https://t.me/01825007977", color: "#2AABEE" },
                { icon: <MessageCircle size={14} />, label: "WhatsApp", href: "https://wa.me/8801825007977", color: "#25D366" },
                { icon: <Youtube size={14} />, label: "YouTube", href: "https://www.youtube.com/@aboenterprise", color: "#FF0000" },
                { icon: <Mail size={14} />, label: "contact@aboenterprise.com", href: "mailto:contact@aboenterprise.com", color: "var(--primary-accent)" },
                { icon: <Phone size={14} />, label: "+880 1825-007977", href: "tel:+8801825007977", color: "var(--accent-green)" },
              ].map(({ icon, label, href, color }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-xs font-medium transition-all hover:bg-white/5"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span style={{ color }}>{icon}</span>
                  {label}
                  {href.startsWith("http") && <ExternalLink size={9} className="ml-auto opacity-40" />}
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Coverage
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              {[
                "⚽ Football", "🏏 Cricket",
                "🏀 Basketball", "🎾 Tennis",
                "🏎️ Formula 1",  "🥊 Boxing / MMA",
                "🏒 Hockey",     "🏈 NFL",
              ].map((s) => (
                <div key={s} style={{ color: "var(--text-muted)" }}>
                  {s}
                </div>
              ))}
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold transition hover:opacity-80"
              style={{ color: "var(--primary-accent)" }}
            >
              <Star size={12} fill="currentColor" />
              Browse channels
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 py-4" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {[
              { icon: <Shield size={11} />, label: "Privacy", href: LEGAL_PDF.privacy },
              { icon: <FileText size={11} />, label: "Terms", href: LEGAL_PDF.terms },
              { icon: <BookOpen size={11} />, label: "License", href: LEGAL_PDF.license },
              { icon: <FileText size={11} />, label: "International", href: LEGAL_PDF.international },
            ].map(({ icon, label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 transition hover:opacity-80"
              >
                {icon} {label}
              </a>
            ))}
          </div>
          <div className="text-[11px] sm:text-right" style={{ color: "var(--text-muted)" }}>
            <p>
              © {new Date().getFullYear()}{" "}
              <Link href="/" className="font-semibold hover:opacity-80" style={{ color: "var(--primary-accent)" }}>
                ABO Sports TV Live
              </Link>
            </p>
            <p className="mt-0.5 max-w-prose text-[10px] leading-snug">
              Third-party streams ·{" "}
              <a href={BRAND.developerWebsiteUrl} target="_blank" rel="noopener noreferrer"
                className="whitespace-nowrap hover:opacity-80 transition" style={{ color: "var(--primary-accent)" }}>
                {BRAND.developer}
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
