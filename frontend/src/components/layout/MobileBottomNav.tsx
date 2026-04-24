"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, User, Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n/LocaleContext";
import { useAuthStore } from "@/store/authStore";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const isAdmin = useAuthStore((s) => s.user?.is_admin);

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
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all"
        style={{ color: isHome ? "var(--primary-accent)" : "var(--text-muted)" }}
      >
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${isHome ? "bg-[rgba(245,166,35,0.15)]" : ""}`}>
          <Home size={19} />
        </div>
        {t("home")}
      </Link>

      <a
        href="#gstv-search"
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all"
        style={{ color: "var(--text-muted)" }}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg">
          <Search size={19} />
        </div>
        {t("search")}
      </a>

      <a
        href="#gstv-search"
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all"
        style={{ color: "var(--text-muted)" }}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg">
          <Trophy size={19} />
        </div>
        Sports
      </a>

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

