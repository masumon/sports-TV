"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/LocaleContext";

export default function OfflinePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);
  const [loadedAt] = useState(() => new Date().toLocaleTimeString("bn-BD"));
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      // Auto-redirect to home when connection is restored
      setTimeout(() => router.push("/"), 800);
    }
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [router]);

  async function handleRetry() {
    setRetrying(true);
    try {
      const res = await fetch("/api/v1/health", { cache: "no-store" });
      if (res.ok) {
        router.push("/");
        return;
      }
    } catch {
      /* still offline */
    }
    setRetrying(false);
  }

  return (
    <main
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 px-4 py-8 text-center safe-pb"
      style={{ background: "var(--bg-dark)" }}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl text-4xl"
        style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)" }}>
        📡
      </div>

      {isOnline ? (
        <>
          <h1 className="text-xl font-bold text-green-400">সংযোগ ফিরে এসেছে!</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>হোমে যাচ্ছি…</p>
        </>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-main)" }}>
              {t("offlineTitle")}
            </h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {t("offlineBody")}
            </p>
          </div>

          <div className="flex flex-col items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <span>পেজ লোড: {loadedAt}</span>
            <span>সংযোগ ফিরলে স্বয়ংক্রিয়ভাবে যাবে</span>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--primary-accent)", color: "#0a0a0f" }}
            >
              {retrying ? "চেক করছি…" : "আবার চেষ্টা করুন"}
            </button>
            <Link
              href="/"
              className="rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-muted)" }}
            >
              {t("goHome")}
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
