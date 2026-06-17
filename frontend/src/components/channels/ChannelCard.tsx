"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";

export type ChannelCardData = {
  id: number;
  name: string;
  logoUrl?: string | null;
  geoHint?: boolean;
  slug?: string;
};

type ChannelCardProps = {
  channel: ChannelCardData;
  active?: boolean;
  isLive?: boolean;
  onSelect?: (channel: ChannelCardData) => void;
  className?: string;
};

function ChannelCardBase({ channel, active = false, isLive = false, onSelect, className }: ChannelCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(channel)}
      className={cn(
        "interactive-transition group flex w-full flex-col items-center gap-2 rounded-2xl border bg-surface-secondary p-3 text-center",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        active
          ? "glow-gold border-accent-gold"
          : "border-border-subtle hover:neon-border hover:scale-[1.02]",
        className,
      )}
      aria-pressed={active}
      aria-label={channel.name}
    >
      <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-white sm:h-[4.5rem] sm:w-[4.5rem]">
        {channel.logoUrl ? (
          <Image
            src={channel.logoUrl}
            alt=""
            width={64}
            height={64}
            className="object-contain p-1"
            loading="lazy"
          />
        ) : (
          <span className="text-sm font-bold text-white" style={{ background: "rgba(30,30,50,0.85)", padding: "0.35em 0.5em", borderRadius: "0.5rem" }}>{channel.name.slice(0, 2).toUpperCase()}</span>
        )}
        {isLive ? (
          <span className="absolute right-0 top-0 rounded-full bg-live-red px-1 py-px text-[8px] font-black uppercase tracking-wide text-white live-pulse">
            Live
          </span>
        ) : null}
        {channel.geoHint ? (
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500/90 px-1.5 py-px text-[8px] font-black uppercase tracking-wide text-white shadow-sm">
            VPN
          </span>
        ) : null}
      </div>
      <p className="line-clamp-2 w-full text-xs font-medium text-foreground sm:text-sm">{channel.name}</p>
    </button>
  );
}

export const ChannelCard = React.memo(ChannelCardBase);
