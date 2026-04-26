"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ExternalLink,
  Mail,
  Phone,
  Globe,
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
  return (
    <footer
      className="mt-auto"
      style={{
        background: "linear-gradient(180deg, var(--bg-card) 0%, #04050A 100%)",
        borderTop: "1px solid rgba(245,166,35,0.12)",
      }}
    >
      <div
        className="relative overflow-hidden py-7"
        style={{
          background: "linear-gradient(135deg, rgba(245,166,35,0.05) 0%, rgba(13,15,28,0.4) 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 sm:flex-row sm:gap-6 sm:text-left">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg"
            style={{
              background: "linear-gradient(145deg, rgba(245,166,35,0.2), rgba(7,8,15,0.9))",
              border: "1px solid rgba(245,166,35,0.35)",
            }}
          >
            <Image src="/icons/abo-logo.svg" alt="ABO Sports TV" width={44} height={44} />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2
              className="text-lg font-black uppercase tracking-[0.12em] leading-tight"
              style={{ color: "var(--primary-accent)" }}
            >
              ABO Sports TV Live
            </h2>
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              Global live sports, India &amp; Bangladesh TV — one app.
            </p>
          </div>
          <div className="shrink-0">
            <span className="live-badge inline-flex items-center">
              <Radio size={10} className="animate-pulse" /> Live
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
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
              HLS player, PWA install, real-time scores. Optimized for smooth playback on mobile networks.
            </p>
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {["HLS", "PWA", "Multi-region", "HD"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-2.5 py-1"
                  style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", color: "var(--primary-accent)" }}
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
              {["Football", "Cricket", "Basketball", "Tennis", "Combat", "Racing", "Hockey", "Golf"].map((s) => (
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

      <div className="px-4 py-5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {[
              { icon: <Shield size={11} />, label: "Privacy", href: LEGAL_PDF.privacy },
              { icon: <FileText size={11} />, label: "Terms", href: LEGAL_PDF.terms },
              { icon: <BookOpen size={11} />, label: "License", href: LEGAL_PDF.license },
              { icon: <Globe size={11} />, label: "International", href: LEGAL_PDF.international },
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
              Third-party streams · <span className="whitespace-nowrap">ABO Enterprise</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
