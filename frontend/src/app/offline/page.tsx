"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/LocaleContext";

export default function OfflinePage() {
  const { t } = useI18n();
  return (
    <main
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"
      style={{ background: "var(--bg-dark)" }}
    >
      <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
        {t("offlineTitle")}
      </h1>
      <p className="max-w-md" style={{ color: "var(--text-muted)" }}>
        {t("offlineBody")}
      </p>
      <Link
        href="/"
        className="rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
        style={{ background: "var(--primary-accent)", color: "#0a0a0f" }}
      >
        {t("goHome")}
      </Link>
    </main>
  );
}
