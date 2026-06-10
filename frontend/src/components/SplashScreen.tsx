"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function SplashScreen({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setFadeOut(true);
    const t = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(t);
  }, [ready]);

  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      aria-label="অ্যাপ প্রস্তুত হচ্ছে…"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse 90% 80% at 50% 35%, #141628 0%, #080a11 55%, #04050c 100%)",
        transition: "opacity 0.6s cubic-bezier(0.4,0,0.2,1)",
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? "none" : "auto",
        userSelect: "none",
      }}
    >
      {/* Stadium atmosphere */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 20% 80%, rgba(16,185,129,0.08), transparent 40%), radial-gradient(circle at 80% 20%, rgba(239,68,68,0.08), transparent 35%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", width: 136, height: 136 }}>
        <div
          style={{
            position: "absolute",
            inset: -10,
            borderRadius: "50%",
            border: "1.5px solid rgba(245,166,35,0.14)",
            borderTopColor: "rgba(229,9,20,0.4)",
            animation: "splash-spin 3.5s linear infinite reverse",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "3px solid transparent",
            borderTopColor: "#F5A623",
            borderRightColor: "rgba(245,166,35,0.45)",
            animation: "splash-spin 1.0s cubic-bezier(0.4,0,0.6,1) infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 14,
            borderRadius: 22,
            background: "#ffffff",
            border: "2px solid rgba(245,166,35,0.5)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            animation: "splash-pulse 2.4s ease-in-out infinite",
          }}
        >
          <Image
            src="/icons/abo-sports-tv-logo.png"
            alt="ABO Sports TV"
            width={78}
            height={78}
            style={{ objectFit: "contain", padding: 5 }}
            priority
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/icons/abo-logo.svg";
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: 28, textAlign: "center", lineHeight: 1 }}>
        <p
          style={{
            fontSize: 24,
            fontWeight: 900,
            letterSpacing: "0.14em",
            background: "linear-gradient(135deg, #F5A623 0%, #E8C84A 40%, #C9A227 70%, #F5A623 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            marginBottom: 8,
          }}
        >
          ABO SPORTS TV
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: "0.12em" }}>
          ⚽ FIFA · 🏏 Cricket · 🏟️ Live Stadium
        </p>
      </div>

      <div
        style={{
          marginTop: 28,
          width: 180,
          height: 3,
          borderRadius: 99,
          background: "rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}
      >
        <div style={{ width: "100%", height: "100%", animation: "splash-shimmer 1.5s ease-in-out infinite" }}>
          <div
            style={{
              width: "45%",
              height: "100%",
              borderRadius: 99,
              background: "linear-gradient(90deg, transparent, #F5A623, rgba(245,166,35,0.5), transparent)",
            }}
          />
        </div>
      </div>

      <p
        style={{
          marginTop: 16,
          fontSize: 13,
          fontWeight: 500,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.04em",
        }}
      >
        Preparing your experience…
      </p>

      <style>{`
        @keyframes splash-spin { to { transform: rotate(360deg); } }
        @keyframes splash-pulse {
          0%, 100% { opacity: 0.75; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }
        @keyframes splash-shimmer {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(280%); }
        }
      `}</style>
    </div>
  );
}
