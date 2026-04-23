"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, User } from "lucide-react";
import { useI18n } from "@/lib/i18n/LocaleContext";
import { useAuthStore } from "@/store/authStore";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const isAdmin = useAuthStore((s) => s.user?.is_admin);
  return (
    <nav className="safe-pb fixed bottom-0 left-0 right-0 z-30 flex h-16 items-stretch justify-around border-t border-slate-800/90 bg-slate-950/95 px-1 pb-[env(safe-area-inset-bottom,0px)] md:hidden">
      <Link
        href="/"
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${
          pathname === "/" ? "text-cyan-300" : "text-slate-500"
        } `}
      >
        <Home size={20} />
        {t("home")}
      </Link>
      <a
        href="#gstv-search"
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] text-slate-500"
      >
        <Search size={20} />
        {t("search")}
      </a>
      <Link
        href={isAdmin ? "/admin/dashboard" : "/admin/login"}
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${
          pathname?.startsWith("/admin") ? "text-cyan-300" : "text-slate-500"
        } `}
      >
        <User size={20} />
        {t("admin")}
      </Link>
    </nav>
  );
}
