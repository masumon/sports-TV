"use client";

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
          {/* Inline ABO logo SVG */}
          <svg viewBox="0 0 192 192" width={72} height={72} aria-hidden>
            <defs>
              <linearGradient id="sp-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0D0F1C" />
                <stop offset="100%" stopColor="#07080F" />
              </linearGradient>
              <linearGradient id="sp-gold" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F5A623" />
                <stop offset="100%" stopColor="#C9A227" />
              </linearGradient>
            </defs>
            <rect width="192" height="192" rx="40" fill="url(#sp-bg)" />
            <g transform="translate(14 68) scale(0.72)">
              <polygon points="8,60 26,12 44,60" fill="url(#sp-gold)" />
              <rect x="16.5" y="42" width="19" height="5" fill="#080A14" />
              <rect x="50" y="12" width="6" height="48" fill="url(#sp-gold)" />
              <path d="M56 12 Q76 12 76 27 Q76 36 56 36" fill="url(#sp-gold)" />
              <path d="M56 36 Q78 36 78 49 Q78 60 56 60" fill="url(#sp-gold)" />
              <circle cx="105" cy="38" r="20" fill="none" stroke="url(#sp-gold)" strokeWidth="6" />
              <path d="M108,18 C114,5 128,10 120,24 C128,8 140,18 130,32" fill="#CC2828" />
            </g>
          </svg>
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
