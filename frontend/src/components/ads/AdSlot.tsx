"use client";

import { useSubscriptionStore } from "@/store/subscriptionStore";

type Props = { variant: "banner" | "inline"; className?: string };

export function AdSlot({ variant, className = "" }: Props) {
  const tier = useSubscriptionStore((s) => s.tier);
  if (tier === "premium") return null;

  return (
    <div
      className={`flex items-center justify-center rounded-lg border border-dashed border-slate-600/60 bg-slate-800/30 text-center text-xs text-slate-500 ${variant === "banner" ? "min-h-14 w-full" : "min-h-20"} ${className}`}
      data-ad-slot={variant}
    >
      <span>Ad slot — connect Google AdSense (slot id)</span>
    </div>
  );
}
