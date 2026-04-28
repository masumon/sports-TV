"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LayoutGrid, Search, Trophy, Tv, User } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/LocaleContext";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const isAdmin = useAuthStore((s) => s.user?.is_admin);
  const activeModule = useUiStore((s) => s.activeModule);
  const setActiveModule = useUiStore((s) => s.setActiveModule);
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus);
  const [moreOpen, setMoreOpen] = useState(false);

  const isHome = pathname === "/";
  return (
    <>
      {moreOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] md:hidden"
          aria-label="Close menu"
          onClick={() => setMoreOpen(false)}
        />
      ) : null}
      {moreOpen ? (
        <div
          className="fixed bottom-16 left-2 right-2 z-50 rounded-xl border p-3 md:hidden"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-card)",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            More
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-2.5 text-left text-sm font-medium"
              style={{
                background: activeModule === "fast_tv" ? "rgba(245,166,35,0.12)" : "rgba(255,255,255,0.05)",
                color: "var(--text-main)",
              }}
              onClick={() => {
                setActiveModule("fast_tv");
                setMoreOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              ⚡ FAST TV
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-2.5 text-left text-sm font-medium"
              style={{
                background: activeModule === "live_matches" ? "rgba(245,166,35,0.12)" : "rgba(255,255,255,0.05)",
                color: "var(--text-main)",
              }}
              onClick={() => {
                setActiveModule("live_matches");
                setMoreOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              🔴 Live Matches
            </button>
            <Link
              href={isAdmin ? "/admin/dashboard" : "/admin/login"}
              className="col-span-2 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}
              onClick={() => setMoreOpen(false)}
            >
              <User size={17} /> {t("admin")}
            </Link>
          </div>
        </div>
      ) : null}

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-stretch justify-around pb-[env(safe-area-inset-bottom,0px)] md:hidden"
        style={{
          background: "var(--bg-glass)",
          borderTop: "1px solid var(--border)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 -2px 12px rgba(0,0,0,0.2)",
        }}
      >
        <Link
          href="/"
          onClick={() => {
            setActiveModule("global_sports");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all"
          style={{
            color: isHome && activeModule === "global_sports" ? "var(--primary-accent)" : "var(--text-muted)",
          }}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
              isHome && activeModule === "global_sports" ? "bg-[rgba(245,166,35,0.15)]" : ""
            }`}
          >
            <Home size={19} />
          </div>
          🌍
        </Link>

        <button
          type="button"
          onClick={() => {
            if (pathname !== "/") {
              try {
                sessionStorage.setItem("gstv-focus-search", "1");
              } catch {
                /* */
              }
              router.push("/");
              return;
            }
            requestSearchFocus();
            document.getElementById("gstv-search")?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all"
          style={{ color: "var(--text-muted)" }}
          aria-label={t("search")}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg">
            <Search size={19} />
          </div>
          {t("search")}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveModule("bangladesh");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all"
          style={{ color: activeModule === "bangladesh" ? "#10b981" : "var(--text-muted)" }}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
              activeModule === "bangladesh" ? "bg-[rgba(16,185,129,0.15)]" : ""
            }`}
          >
            <Tv size={19} />
          </div>
          🇧🇩
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveModule("india");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all"
          style={{ color: activeModule === "india" ? "rgb(199 210 254)" : "var(--text-muted)" }}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
              activeModule === "india" ? "bg-[rgba(99,102,241,0.2)]" : ""
            }`}
          >
            <Trophy size={19} />
          </div>
          🇮🇳
        </button>

        <button
          type="button"
          onClick={() => {
            setMoreOpen((v) => !v);
          }}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all"
          style={{ color: moreOpen ? "var(--primary-accent)" : "var(--text-muted)" }}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
              moreOpen ? "bg-[rgba(245,166,35,0.15)]" : ""
            }`}
          >
            <LayoutGrid size={19} />
          </div>
          More
        </button>
      </nav>
    </>
  );
}
