"use client";

import { useEffect } from "react";
import { useSiteSettingsStore } from "@/store/siteSettingsStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";

type Props = { variant: "banner" | "inline"; className?: string };

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export function AdSlot({ variant, className = "" }: Props) {
  const tier = useSubscriptionStore((s) => s.tier);
  const { adsensePublisherId, adsenseBannerSlot, adsenseInlineSlot, adsenseEnabled } =
    useSiteSettingsStore();

  const slotId = variant === "banner" ? adsenseBannerSlot : adsenseInlineSlot;
  const isConfigured = adsenseEnabled && adsensePublisherId && slotId;

  useEffect(() => {
    if (!isConfigured) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[AdSlot] AdSense push failed — script may not be loaded yet:", err);
      }
    }
  }, [isConfigured]);

  if (tier === "premium") return null;

  if (!isConfigured) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-slate-600/60 bg-slate-800/30 text-center text-xs text-slate-500 ${variant === "banner" ? "min-h-14 w-full" : "min-h-20"} ${className}`}
        data-ad-slot={variant}
      >
        <span className="px-3">Ad — configure Google AdSense in Admin → Settings</span>
      </div>
    );
  }

  return (
    <div
      className={`${variant === "banner" ? "min-h-14 w-full" : "min-h-20"} ${className} overflow-hidden`}
    >
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={adsensePublisherId}
        data-ad-slot={slotId}
        data-ad-format={variant === "banner" ? "auto" : "rectangle"}
        data-full-width-responsive="true"
      />
    </div>
  );
}

