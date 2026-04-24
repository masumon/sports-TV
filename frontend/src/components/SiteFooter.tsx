import { ExternalLink, Github, Globe, Layers, Radio, Smartphone, Star, Zap } from "lucide-react";

const DEVELOPER_SITE = "https://mumainsumon.netlify.app/";
const GITHUB_PROFILE = "https://github.com/masumon";
const REPO_URL = "https://github.com/masumon/sports-TV";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-slate-800/60 bg-gradient-to-b from-slate-950 to-[#020817] text-slate-400">
      {/* Main grid */}
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* ── 1. BRAND ───────────────────────────────────────────── */}
          <div className="space-y-3 lg:col-span-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 ring-1 ring-sky-500/30">
                <Radio size={16} className="text-sky-400" />
              </span>
              <span className="text-sm font-bold uppercase tracking-widest text-sky-400">
                Global Sports Live TV
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              Live sports streaming platform with real-time data
            </p>
            <p className="text-xs leading-relaxed text-slate-500">
              লাইভ স্পোর্টস স্ট্রিমিং প্ল্যাটফর্ম (রিয়েল-টাইম ডেটা সহ)
            </p>
          </div>

          {/* ── 2. DEVELOPER CREDIT ────────────────────────────────── */}
          <div className="lg:col-span-1">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Built by
            </p>
            <div className="group rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 ring-1 ring-transparent transition-all duration-300 hover:border-sky-500/40 hover:ring-sky-500/20 hover:shadow-[0_0_24px_rgba(14,165,233,0.12)]">
              <p className="text-sm font-semibold text-slate-100">Mumain Ahmed</p>
              <p className="mt-0.5 text-xs text-sky-400/80">AI Solution Architect &amp; Full-Stack Engineer</p>

              <div className="mt-3 flex flex-col gap-1.5">
                <a
                  href={DEVELOPER_SITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-sky-300"
                >
                  <Globe size={12} className="shrink-0 text-sky-500/70" />
                  Portfolio
                  <ExternalLink size={10} className="opacity-50" />
                </a>
                <a
                  href={GITHUB_PROFILE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-sky-300"
                >
                  <Github size={12} className="shrink-0 text-sky-500/70" />
                  GitHub
                  <ExternalLink size={10} className="opacity-50" />
                </a>
              </div>

              <p className="mt-3 text-[10px] italic text-slate-500">
                &ldquo;Designed &amp; engineered with modern AI-driven architecture&rdquo;
              </p>
              <p className="text-[10px] text-slate-600">আধুনিক AI-চালিত আর্কিটেকচারে নির্মিত</p>
            </div>
          </div>

          {/* ── 3. SYSTEM INFO ─────────────────────────────────────── */}
          <div className="space-y-4 lg:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Tech Stack
            </p>
            <div className="flex items-center gap-2 rounded-lg bg-slate-900/40 px-3 py-2 ring-1 ring-slate-800/60">
              <Layers size={13} className="shrink-0 text-cyan-400/70" />
              <span className="text-xs text-slate-300">Next.js 15 + FastAPI + PostgreSQL</span>
            </div>

            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Features
            </p>
            <ul className="space-y-1.5">
              {[
                { icon: <Zap size={12} />, label: "HLS Streaming" },
                { icon: <Radio size={12} />, label: "Real-time scores" },
                { icon: <Smartphone size={12} />, label: "PWA support" },
              ].map(({ icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="text-sky-400/70">{icon}</span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* ── 4. LINKS GRID ──────────────────────────────────────── */}
          <div className="space-y-3 lg:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Quick Links
            </p>
            <nav className="grid grid-cols-1 gap-1.5">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-sky-300"
              >
                <Star size={10} className="text-sky-500/50" />
                GitHub Repo
              </a>
              <a
                href={DEVELOPER_SITE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-sky-300"
              >
                <Star size={10} className="text-sky-500/50" />
                Contact
              </a>
              {/* Placeholder items — not yet live */}
              {["API Docs", "System Status"].map((label) => (
                <span
                  key={label}
                  className="inline-flex cursor-default items-center gap-1.5 rounded-md px-3 py-2 text-xs text-slate-600"
                >
                  <Star size={10} className="text-slate-700" />
                  {label}
                  <span className="ml-auto rounded-sm bg-slate-800 px-1 py-0.5 text-[9px] text-slate-700">
                    soon
                  </span>
                </span>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-800/50 py-4 text-center text-[11px] text-slate-600">
        © {year} Global Sports Live TV &nbsp;·&nbsp; সমস্ত স্ট্রিম তৃতীয় পক্ষের উৎসের জন্য দায়বদ্ধ নয়
      </div>
    </footer>
  );
}
