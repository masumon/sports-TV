"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Search, Tv, Trophy, User } from "lucide-react";
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

  const isHome = pathname === "/";
  const isAdminPage = pathname?.startsWith("/admin");

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-stretch justify-around pb-[env(safe-area-inset-bottom,0px)] md:hidden"
      style={{
        background: "rgba(7,8,15,0.97)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
      }}
    >
      <Link
        href="/"
        onClick={() => setActiveModule("sports")}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all"
        style={{ color: isHome && activeModule === "sports" ? "var(--primary-accent)" : "var(--text-muted)" }}
      >
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${isHome && activeModule === "sports" ? "bg-[rgba(245,166,35,0.15)]" : ""}`}>
          <Home size={19} />
        </div>
        {t("home")}
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
          setActiveModule("india");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all"
        style={{ color: activeModule === "india" ? "rgb(199 210 254)" : "var(--text-muted)" }}
      >
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${activeModule === "india" ? "bg-[rgba(99,102,241,0.2)]" : ""}`}>
          <Trophy size={19} />
        </div>
        🇮🇳 IN
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
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${activeModule === "bangladesh" ? "bg-[rgba(16,185,129,0.15)]" : ""}`}>
          <Tv size={19} />
        </div>
        🇧🇩 BD
      </button>

      <Link
        href={isAdmin ? "/admin/dashboard" : "/admin/login"}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all"
        style={{ color: isAdminPage ? "var(--primary-accent)" : "var(--text-muted)" }}
      >
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${isAdminPage ? "bg-[rgba(245,166,35,0.15)]" : ""}`}>
          <User size={19} />
        </div>
        {t("admin")}
      </Link>
    </nav>
  );
}

