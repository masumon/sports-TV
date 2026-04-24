import Image from "next/image";
import {
  ExternalLink, Mail, Phone, Globe, Shield, FileText, BookOpen,
  Youtube, Facebook, Send, MessageCircle, Radio, Tv, Star,
} from "lucide-react";

const ABO_NETLIFY = "https://aboenterprise.netlify.app/";
const SUMONIX_AI  = "https://sumonix.netlify.app/";

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
              World's premier free live sports streaming — All sports · All countries · 24/7
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
                {
                  icon: <Facebook size={15} />,
                  label: "Facebook",
                  href: "https://facebook.com/aboenterprise",
                  color: "#1877F2",
                },
                {
                  icon: <Send size={15} />,
                  label: "Telegram",
                  href: "https://t.me/aboenterprise",
                  color: "#2AABEE",
                },
                {
                  icon: <MessageCircle size={15} />,
                  label: "WhatsApp",
                  href: "https://wa.me/message/aboenterprise",
                  color: "#25D366",
                },
                {
                  icon: <Youtube size={15} />,
                  label: "YouTube",
                  href: "https://youtube.com/@aboenterprise",
                  color: "#FF0000",
                },
                {
                  icon: <Mail size={15} />,
                  label: "Email Us",
                  href: "mailto:contact@aboenterprise.com",
                  color: "var(--primary-accent)",
                },
                {
                  icon: <Phone size={15} />,
                  label: "Support",
                  href: "tel:+8801XXXXXXXXX",
                  color: "var(--accent-green)",
                },
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
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold transition hover:opacity-80"
              style={{ color: "var(--primary-accent)" }}
            >
              <Star size={12} fill="currentColor" />
              View all 300+ channels →
            </a>
          </div>

          {/* ── 4. BUILT BY / POWERED BY ── */}
          <div className="space-y-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Built By
            </p>

            {/* ABO ENTERPRISE card */}
            <a
              href={ABO_NETLIFY}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl p-4 transition-all hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, rgba(245,166,35,0.1) 0%, rgba(229,57,53,0.05) 100%)",
                border: "1px solid rgba(245,166,35,0.25)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(245,166,35,0.15)" }}>
                  <Image src="/icons/abo-logo.svg" alt="ABO" width={24} height={24} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--primary-accent)" }}>
                    ABO ENTERPRISE
                  </p>
                  <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>Simple Solutions</p>
                </div>
              </div>
              <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Innovative technology solutions for the modern digital world.
              </p>
              <div className="mt-2 flex items-center gap-1 text-[10px]" style={{ color: "var(--primary-accent)" }}>
                <Globe size={10} /> Visit website <ExternalLink size={9} />
              </div>
            </a>

            {/* SUMONIX AI card */}
            <a
              href={SUMONIX_AI}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl p-3.5 transition-all hover:scale-[1.02]"
              style={{
                background: "rgba(30,110,232,0.06)",
                border: "1px solid rgba(30,110,232,0.2)",
              }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] mb-1" style={{ color: "var(--text-muted)" }}>
                Powered by
              </p>
              <p className="text-sm font-black uppercase tracking-wider" style={{ color: "var(--accent-blue)" }}>
                SUMONIX AI
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                AI-driven architecture & intelligence
              </p>
              <div className="mt-1.5 flex items-center gap-1 text-[10px]" style={{ color: "var(--accent-blue)" }}>
                <ExternalLink size={9} /> sumonix.netlify.app
              </div>
            </a>
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
              { icon: <Shield size={11} />, label: "Privacy Policy", href: "#" },
              { icon: <FileText size={11} />, label: "Terms of Service", href: "#" },
              { icon: <BookOpen size={11} />, label: "License", href: "#" },
              { icon: <Globe size={11} />, label: "International Use", href: "#" },
            ].map(({ icon, label, href }) => (
              <a
                key={label}
                href={href}
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
              <a href={ABO_NETLIFY} target="_blank" rel="noreferrer" className="font-semibold hover:opacity-80" style={{ color: "var(--primary-accent)" }}>
                ABO SPORTS TV LIVE
              </a>
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

