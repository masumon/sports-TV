"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";

export type ChannelCardData = {
  id: number;
  name: string;
  logoUrl?: string | null;
  slug?: string;
};

type ChannelCardProps = {
  channel: ChannelCardData;
  active?: boolean;
  isLive?: boolean;
  onSelect?: (channel: ChannelCardData) => void;
  className?: string;
};

export function ChannelCard({ channel, active = false, isLive = false, onSelect, className }: ChannelCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(channel)}
      className={cn(
        "interactive-transition group flex w-full flex-col items-center gap-2 rounded-xl border bg-surface-secondary p-3 text-center",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        active
          ? "glow-gold border-accent-gold"
          : "border-border-subtle hover:neon-border hover:scale-[1.02]",
        className,
      )}
      aria-pressed={active}
      aria-label={channel.name}
    >
      <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-white sm:h-16 sm:w-16">
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
          <span className="text-sm font-bold text-surface">{channel.name.slice(0, 2).toUpperCase()}</span>
        )}
        {isLive ? (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-live-red live-pulse" aria-hidden />
        ) : null}
      </div>
      <p className="line-clamp-2 w-full text-xs font-medium text-foreground sm:text-sm">{channel.name}</p>
    </button>
  );
}
