"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ExternalLink, Mail, Phone, Globe, Shield, FileText, BookOpen,
  Youtube, Facebook, Send, MessageCircle, Radio, Tv, Star,
  Linkedin, Github, Briefcase, User2, Sparkles,
} from "lucide-react";

const DEVELOPER_URL = "https://mumainsumon.netlify.app";
const SUMONIX_AI    = "https://sumonix-ai.vercel.app";
const DEVELOPER_LINKEDIN = "https://bd.linkedin.com/in/mumain-ahmed-907057211";
const DEVELOPER_GITHUB   = "https://github.com/masumon";
const DEVELOPER_FIVERR  = "https://www.fiverr.com/mumain_sumon";

const LEGAL_PDF = {
  privacy: "/legal/abo-sports-tv-privacy-policy.pdf",
  terms: "/legal/abo-sports-tv-terms-of-service.pdf",
  license: "/legal/abo-sports-tv-license.pdf",
  international: "/legal/abo-sports-tv-international-use.pdf",
} as const;

function iconLinkClass(accent: "amber" | "blue") {
  const focus =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04050A]";
  const ring =
    accent === "amber"
      ? "focus-visible:ring-[var(--primary-accent)]/60"
      : "focus-visible:ring-[var(--accent-blue)]/60";
  return [
    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
    accent === "amber"
      ? "text-[var(--primary-accent)] hover:bg-white/[0.08] active:bg-white/[0.12]"
      : "text-[var(--accent-blue)] hover:bg-white/[0.08] active:bg-white/[0.12]",
    focus,
    ring,
  ].join(" ");
}

export function SiteFooter() {
  return (
    <footer
      className="mt-auto"
      style={{
        background: "linear-gradient(180deg, var(--bg-card) 0%, #04050A 100%)",
        borderTop: "1px solid rgba(245,166,35,0.15)",
      }}
    >
      {/* ── Top brand strip ── */}
      <div
        className="relative overflow-hidden py-8"
        style={{
          background: "linear-gradient(135deg, rgba(245,166,35,0.07) 0%, rgba(229,57,53,0.05) 50%, rgba(30,110,232,0.05) 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-4 text-center sm:flex-row sm:text-left sm:gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl" style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)" }}>
            <Image src="/icons/abo-logo.svg" alt="ABO SPORTS TV LIVE" width={48} height={48} />
          </div>
          <div className="min-w-0">
            <h2
              className="text-xl font-black uppercase tracking-[0.15em] leading-tight"
              style={{ color: "var(--primary-accent)" }}
            >
              ABO SPORTS TV LIVE
            </h2>
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              বিশ্বের সকল দেশের সব ধরনের খেলাধুলার লাইভ স্ট্রিমিং প্ল্যাটফর্ম
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              World{"'"}s premier free live sports streaming — All sports · All countries · 24/7
            </p>
          </div>
          <div className="sm:ml-auto flex items-center gap-2 shrink-0">
            <span className="live-badge">
              <Radio size={10} className="animate-pulse" /> LIVE NOW
            </span>
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">

          {/* ── 1. BRAND & ABOUT ── */}
          <div className="space-y-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              About
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Tv size={14} style={{ color: "var(--primary-accent)" }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-main)" }}>
                  ABO SPORTS TV LIVE
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Watch live sports from every country — Football, Cricket, Basketball, Tennis, and 20+ more sports in HD quality.
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                বিশ্বের ৩০০+ চ্যানেল, সকল খেলাধুলা, সব দেশ — বিনামূল্যে লাইভ।
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {["HD Streaming", "HLS Player", "PWA", "Real-time Scores"].map((tag) => (
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

          {/* ── 2. CONTACT ── */}
          <div className="space-y-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Contact Us
            </p>
            <div className="space-y-2">
              {[
                { icon: <Facebook size={15} />, label: "ABO Enterprise", href: "https://www.facebook.com/abo.enterprise", color: "#1877F2" },
                { icon: <Facebook size={15} />, label: "Sumon (Personal)", href: "https://www.facebook.com/sumon.mumain", color: "#1877F2" },
                { icon: <Send size={15} />, label: "Telegram", href: "https://t.me/01825007977", color: "#2AABEE" },
                { icon: <MessageCircle size={15} />, label: "WhatsApp", href: "https://wa.me/8801825007977", color: "#25D366" },
                { icon: <Youtube size={15} />, label: "YouTube", href: "https://www.youtube.com/@aboenterprise", color: "#FF0000" },
                { icon: <Briefcase size={15} />, label: "Fiverr", href: "https://www.fiverr.com/mumain_sumon", color: "#1dbf73" },
                { icon: <Mail size={15} />, label: "Business Email", href: "mailto:contact@aboenterprise.com", color: "var(--primary-accent)" },
                { icon: <Mail size={15} />, label: "Personal Email", href: "mailto:m.a.sumon92@gmail.com", color: "var(--text-muted)" },
                { icon: <Phone size={15} />, label: "+880 1825-007977", href: "tel:+8801825007977", color: "var(--accent-green)" },
              ].map(({ icon, label, href, color }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all hover:bg-white/5"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span style={{ color }}>{icon}</span>
                  {label}
                  {href.startsWith("http") && <ExternalLink size={9} className="ml-auto opacity-40" />}
                </a>
              ))}
            </div>
          </div>

          {/* ── 3. SPORTS CHANNELS ── */}
          <div className="space-y-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Sports Coverage
            </p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
              {[
                "⚽ Football", "🏏 Cricket", "🏀 Basketball", "🎾 Tennis",
                "⚾ Baseball", "🏉 Rugby", "🏒 Hockey", "⛳ Golf",
                "🥊 Boxing", "🥋 MMA/UFC", "🏎️ Formula 1", "🏓 Table Tennis",
                "🏸 Badminton", "🏊 Swimming", "🚴 Cycling", "🏃 Athletics",
              ].map((sport) => (
                <div key={sport} className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                  <span>{sport}</span>
                </div>
              ))}
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold transition hover:opacity-80"
              style={{ color: "var(--primary-accent)" }}
            >
              <Star size={12} fill="currentColor" />
              View all 300+ channels →
            </Link>
          </div>

          {/* ── 4. CREDITS (DEVELOPER + TECH) — international layout, icon-only external links */}
          <div className="space-y-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Credits
            </p>

            <article
              className="rounded-2xl p-4 transition-shadow duration-200 hover:shadow-lg hover:shadow-black/20"
              style={{
                background: "linear-gradient(135deg, rgba(245,166,35,0.1) 0%, rgba(229,57,53,0.05) 100%)",
                border: "1px solid rgba(245,166,35,0.25)",
              }}
              aria-labelledby="credits-dev-heading"
            >
              <div className="mb-3 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(245,166,35,0.15)" }}
                  aria-hidden
                >
                  <User2 size={20} style={{ color: "var(--primary-accent)" }} />
                </div>
                <div className="min-w-0">
                  <h3
                    id="credits-dev-heading"
                    className="text-sm font-black uppercase tracking-[0.12em] text-balance"
                    style={{ color: "var(--primary-accent)" }}
                  >
                    Mumain Ahmed
                  </h3>
                  <p className="text-[10px] leading-snug" style={{ color: "var(--text-muted)" }}>
                    Full-stack developer, ABO Enterprise
                  </p>
                </div>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Building modern, AI-assisted digital platforms and streaming experiences.
              </p>
              <div className="mt-3 border-t border-white/[0.06] pt-3">
                <p className="visuallyHidden">Profile and social links (open in a new tab)</p>
                <ul className="flex flex-wrap items-center gap-1 sm:gap-1.5" aria-label="Developer profile and social">
                  {[
                    {
                      key: "portfolio",
                      href: DEVELOPER_URL,
                      icon: <Globe size={16} className="shrink-0" />,
                      label: "Developer portfolio website",
                    },
                    { key: "linkedin", href: DEVELOPER_LINKEDIN, icon: <Linkedin size={16} />, label: "LinkedIn profile", title: "LinkedIn" },
                    { key: "github", href: DEVELOPER_GITHUB, icon: <Github size={16} />, label: "GitHub profile", title: "GitHub" },
                    { key: "fiverr", href: DEVELOPER_FIVERR, icon: <Briefcase size={16} />, label: "Fiverr profile", title: "Fiverr" },
                  ].map(({ key, href, icon, label, title }) => (
                    <li key={key}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={iconLinkClass("amber")}
                        style={{ color: "var(--primary-accent)" }}
                        aria-label={label}
                        {...(title !== undefined ? { title } : {})}
                      >
                        {icon}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <article
              className="rounded-2xl p-4 transition-shadow duration-200 hover:shadow-lg hover:shadow-black/15"
              style={{
                background: "rgba(30,110,232,0.08)",
                border: "1px solid rgba(30,110,232,0.22)",
              }}
              aria-labelledby="credits-sumonix-heading"
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: "var(--text-muted)" }}>
                Powered by
              </p>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3
                    id="credits-sumonix-heading"
                    className="text-sm font-black uppercase tracking-[0.1em] text-balance"
                    style={{ color: "var(--accent-blue)" }}
                  >
                    SUMONIX AI
                  </h3>
                  <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    AI architecture, data intelligence, and product engineering.
                  </p>
                </div>
                <a
                  href={SUMONIX_AI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={iconLinkClass("blue")}
                  style={{ color: "var(--accent-blue)" }}
                  aria-label="SUMONIX AI — open website"
                >
                  <Sparkles size={20} className="shrink-0" />
                </a>
              </div>
            </article>
          </div>

        </div>
      </div>

      {/* ── Legal / bottom bar ── */}
      <div
        className="px-4 py-5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="mx-auto max-w-7xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Legal links */}
          <div className="flex flex-wrap items-center gap-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {[
              { icon: <Shield size={11} />, label: "Privacy Policy", href: LEGAL_PDF.privacy },
              { icon: <FileText size={11} />, label: "Terms of Service", href: LEGAL_PDF.terms },
              { icon: <BookOpen size={11} />, label: "License", href: LEGAL_PDF.license },
              { icon: <Globe size={11} />, label: "International Use", href: LEGAL_PDF.international },
            ].map(({ icon, label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 transition hover:opacity-80"
                style={{ color: "var(--text-muted)" }}
              >
                {icon} {label}
              </a>
            ))}
          </div>

          {/* Copyright */}
          <div className="text-[11px] text-center sm:text-right" style={{ color: "var(--text-muted)" }}>
            <p>
              © 2026{" "}
              <Link href="/" className="font-semibold hover:opacity-80" style={{ color: "var(--primary-accent)" }}>
                ABO SPORTS TV LIVE
              </Link>
              {" "}· All Rights Reserved
            </p>
            <p className="mt-0.5 text-[10px]">
              সমস্ত স্ট্রিম তৃতীয় পক্ষের উৎস থেকে সংগ্রহীত · Third-party streams only
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

