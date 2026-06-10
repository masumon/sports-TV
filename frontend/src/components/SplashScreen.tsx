"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { BRAND } from "@/lib/branding";

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
      <Image
        src={BRAND.logo.png}
        alt={BRAND.name}
        width={96}
        height={96}
        style={{ objectFit: "contain", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.45))" }}
        priority
      />
      <p
        style={{
          marginTop: 16,
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.12em",
          color: "#F5A623",
        }}
      >
        {BRAND.nameFull}
      </p>
    </div>
  );
}
