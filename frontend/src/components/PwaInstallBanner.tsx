"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Share } from "lucide-react";
import { BRAND } from "@/lib/branding";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "pwa-install-dismissed-v2";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

export function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosGuide, setIosGuide] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (isInStandaloneMode()) return;

    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch { /* */ }

    if (isIos()) {
      // iOS Safari doesn't fire beforeinstallprompt — show manual guide after 3s
      const t = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(t);
    }

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
    setIosGuide(false);
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* */ }
  }

  async function install() {
    if (!prompt) { setIosGuide(true); return; }
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setPrompt(null);
    dismiss();
  }

  if (!visible) return null;

  const showIos = isIos() || iosGuide;

  return (
    <>
      <div
        className="fixed z-50 flex flex-col gap-3 rounded-2xl p-3 shadow-2xl"
        style={{
          bottom: "calc(4.75rem + env(safe-area-inset-bottom, 0px))",
          left: "0.75rem",
          right: "0.75rem",
          background: "rgba(11,15,25,0.97)",
          border: "1px solid rgba(245,166,35,0.45)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <Image src={BRAND.logo.png} alt={BRAND.name} width={44} height={44} className="object-contain" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-white leading-tight">Install App</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Add to home screen — faster & offline-ready
            </p>
          </div>

          {!showIos && (
            <button
              type="button"
              onClick={() => void install()}
              className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition active:scale-95"
              style={{ background: "var(--primary-accent)", color: "#0a0a0f" }}
            >
              Install
            </button>
          )}

          {showIos && (
            <button
              type="button"
              onClick={() => setIosGuide((v) => !v)}
              className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition active:scale-95"
              style={{ background: "rgba(245,166,35,0.15)", color: "var(--primary-accent)", border: "1px solid rgba(245,166,35,0.35)" }}
            >
              How?
            </button>
          )}

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

        {/* iOS step-by-step guide */}
        {showIos && (
          <div
            className="rounded-xl px-3 py-2.5 text-[11px] leading-relaxed"
            style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", color: "var(--text-muted)" }}
          >
            <p className="font-bold mb-1.5" style={{ color: "var(--primary-accent)" }}>
              iOS Install Guide:
            </p>
            <ol className="space-y-1 list-none">
              <li>1. Tap <Share size={11} className="inline mx-0.5 -mt-0.5" /> <strong className="text-white">Share</strong> in Safari toolbar</li>
              <li>2. Scroll down → tap <strong className="text-white">Add to Home Screen</strong></li>
              <li>3. Tap <strong className="text-white">Add</strong> — done! 🎉</li>
            </ol>
          </div>
        )}
      </div>
    </>
  );
}
