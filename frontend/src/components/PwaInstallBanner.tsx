"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed";

export function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISSED_KEY)) return;
    } catch { /* */ }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setVisible(false);
    try { sessionStorage.setItem(DISMISSED_KEY, "1"); } catch { /* */ }
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setPrompt(null);
    dismiss();
  }

  if (!visible || !prompt) return null;

  return (
    <div
      className="fixed z-50 flex items-center gap-3 rounded-2xl p-3 shadow-2xl"
      style={{
        bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
        left: "0.75rem",
        right: "0.75rem",
        background: "rgba(11,15,25,0.97)",
        border: "1px solid rgba(245,166,35,0.45)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{ background: "#fff", border: "1.5px solid rgba(245,166,35,0.4)" }}
      >
        <Image src="/icons/abo-logo.svg" alt="ABO Sports TV" width={40} height={40} className="object-contain p-0.5" unoptimized />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-white leading-tight">App ইনস্টল করুন</p>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Home screen-এ যোগ করুন — faster ও offline-ready
        </p>
      </div>

      <button
        type="button"
        onClick={() => void install()}
        className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition active:scale-95"
        style={{ background: "var(--primary-accent)", color: "#0a0a0f" }}
      >
        ইনস্টল
      </button>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Close"
        className="shrink-0 rounded-lg p-1.5 transition hover:bg-white/10"
        style={{ color: "var(--text-muted)" }}
      >
        ✕
      </button>
    </div>
  );
}
