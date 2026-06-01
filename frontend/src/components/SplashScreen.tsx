"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Full-screen branded splash shown on first load while channels fetch in background.
 * Hides itself as soon as `ready` prop turns true (channels available OR timeout).
 */
export function SplashScreen({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setFadeOut(true);
    const t = setTimeout(() => setVisible(false), 500);
    return () => clearTimeout(t);
  }, [ready]);

  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      aria-label="অ্যাপ লোড হচ্ছে…"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 60%, #12142a 0%, #080a11 70%)",
        transition: "opacity 0.5s ease",
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? "none" : "auto",
      }}
    >
      {/* Outer glow ring */}
      <div style={{ position: "relative", width: 120, height: 120 }}>
        {/* Spinning ring */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "3px solid transparent",
            borderTopColor: "#F5A623",
            borderRightColor: "#C9A227",
            animation: "splash-spin 1.1s linear infinite",
          }}
        />
        {/* Slower outer glow ring */}
        <div
          style={{
            position: "absolute",
            inset: -8,
            borderRadius: "50%",
            border: "2px solid rgba(245,166,35,0.18)",
            borderBottomColor: "rgba(229,9,20,0.45)",
            animation: "splash-spin 2.4s linear infinite reverse",
          }}
        />
        {/* Logo circle background */}
        <div
          style={{
            position: "absolute",
            inset: 6,
            borderRadius: "50%",
            background: "rgba(13,15,28,0.9)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            src="/icons/abo-sports-tv-logo.png"
            alt="ABO Sports TV"
            width={72}
            height={72}
            style={{
              borderRadius: 14,
              objectFit: "contain",
              background: "#fff",
              padding: 4,
            }}
            priority
          />
        </div>
      </div>

      {/* Brand name */}
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <p
          style={{
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: "0.12em",
            background: "linear-gradient(135deg,#F5A623,#C9A227,#E8C84A)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            marginBottom: 4,
          }}
        >
          ABO SPORTS TV
        </p>
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.25em",
            color: "rgba(255,255,255,0.45)",
            textTransform: "uppercase",
          }}
        >
          LIVE · HD · PWA
        </p>
      </div>

      {/* Loading dots */}
      <div style={{ marginTop: 28, display: "flex", gap: 8, alignItems: "center" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#F5A623",
              opacity: 0.85,
              animation: `splash-bounce 1.1s ${i * 0.18}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      {/* Hint text */}
      <p
        style={{
          marginTop: 20,
          fontSize: 12,
          color: "rgba(255,255,255,0.28)",
          letterSpacing: "0.05em",
        }}
      >
        চ্যানেল লোড হচ্ছে…
      </p>

      <style>{`
        @keyframes splash-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes splash-bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
