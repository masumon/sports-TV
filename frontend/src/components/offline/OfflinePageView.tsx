"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Radio, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useI18n } from "@/lib/i18n/LocaleContext";

function getOnline() {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function OfflinePageView() {
  const { t } = useI18n();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(getOnline());
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []);

  const handleRetry = useCallback(() => {
    window.location.assign("/");
  }, []);

  return (
    <div
      className="flex min-h-[70vh] flex-1 flex-col items-center justify-center px-4 py-10 sm:min-h-[75vh] sm:px-6"
      style={{ background: "var(--bg-dark)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-lg rounded-2xl p-6 sm:p-8"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)" }}
          >
            <Image src="/icons/abo-logo.svg" alt="" width={40} height={40} className="rounded-lg" />
          </div>
          <div
            className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
            style={{
              background: online ? "rgba(16,185,129,0.12)" : "rgba(229,57,53,0.12)",
              border: `1px solid ${online ? "rgba(16,185,129,0.35)" : "rgba(229,57,53,0.3)"}`,
              color: online ? "var(--accent-green)" : "#FF5252",
            }}
            role="status"
            aria-live="polite"
          >
            {online ? <Wifi size={12} className="shrink-0" /> : <WifiOff size={12} className="shrink-0" />}
            {online ? t("offlineStatusOnline") : t("offlineStatusOffline")}
          </div>
          <h1 className="text-balance text-xl font-extrabold tracking-tight sm:text-2xl" style={{ color: "var(--text-main)" }}>
            {t("offlineTitle")}
          </h1>
          <p className="mt-2 text-balance text-sm leading-relaxed sm:text-[15px]" style={{ color: "var(--text-muted)" }}>
            {t("offlineBody")}
          </p>
        </div>

        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          {t("offlineTipsTitle")}
        </p>
        <ul className="mb-6 space-y-2 text-left text-sm" style={{ color: "var(--text-muted)" }}>
          <li className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-base" aria-hidden>📶</span>
            <span>{t("offlineTipNetwork")}</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-base" aria-hidden>🔄</span>
            <span>{t("offlineTipRetry")}</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-base" aria-hidden>📲</span>
            <span>{t("offlineTipPwa")}</span>
          </li>
        </ul>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition hover:opacity-90"
            style={{ background: "var(--primary-accent)", color: "#0c0d12" }}
          >
            <Radio size={16} className="shrink-0" />
            {t("goHome")}
          </Link>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-semibold transition hover:bg-white/5"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            <RefreshCw size={16} className="shrink-0" />
            {t("offlineRetry")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
