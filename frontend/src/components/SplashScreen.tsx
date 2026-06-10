"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/** Premium OTT splash — max ~1s visible, no fake progress. */
export function SplashScreen({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setFadeOut(true);
    const t = setTimeout(() => setVisible(false), 280);
    return () => clearTimeout(t);
  }, [ready]);

  if (!visible) return null;

  return (
    <div
      aria-hidden={fadeOut}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse 90% 80% at 50% 35%, #141628 0%, #080a11 55%, #04050c 100%)",
        transition: "opacity 0.28s ease-out",
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? "none" : "auto",
      }}
    >
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 20,
          background: "#fff",
          border: "2px solid rgba(245,166,35,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
        }}
      >
        <Image
          src="/icons/abo-sports-tv-logo.png"
          alt=""
          width={64}
          height={64}
          style={{ objectFit: "contain", padding: 4 }}
          priority
        />
      </div>
      <p
        style={{
          marginTop: 16,
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.12em",
          color: "#F5A623",
        }}
      >
        ABO SPORTS TV
      </p>
    </div>
  );
}
