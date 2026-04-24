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
    <nav className="safe-pb fixed bottom-0 left-0 right-0 z-30 flex h-16 items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom,0px)] md:hidden" style={{ background: "var(--bg-card)", borderTop: "1px solid rgb(255 255 255 / 8%)" }}>
      <Link
        href="/"
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${
          pathname === "/" ? "" : ""
        } `}
        style={{ color: pathname === "/" ? "var(--primary-accent)" : "var(--text-muted)" }}
      >
        <Home size={20} />
        {t("home")}
      </Link>
      <a
        href="#gstv-search"
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px]"
        style={{ color: "var(--text-muted)" }}
      >
        <Search size={20} />
        {t("search")}
      </a>
      <Link
        href={isAdmin ? "/admin/dashboard" : "/admin/login"}
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px]`}
        style={{ color: pathname?.startsWith("/admin") ? "var(--primary-accent)" : "var(--text-muted)" }}
      >
        <User size={20} />
        {t("admin")}
      </Link>
    </nav>
  );
}
