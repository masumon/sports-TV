"use client";

import { TrendingUp } from "lucide-react";
import { useMemo } from "react";
import type { Channel } from "@/lib/types";
import { ChannelGrid } from "@/components/channels/ChannelGrid";

type TrendingChannelsProps = {
  allChannels: Channel[];
  recentlyWatched: number[];
  onSelect: (channel: Channel) => void;
};

export function TrendingChannels({ allChannels, recentlyWatched, onSelect }: TrendingChannelsProps) {
  const trendingChannels = useMemo(() => {
    // Trending = most frequently watched from recently-watched list
    const watchCounts = new Map<number, number>();
    recentlyWatched.forEach((id, index) => {
      // More recent watches count more (logarithmic decay)
      const weight = Math.log(recentlyWatched.length - index + 1);
      watchCounts.set(id, (watchCounts.get(id) ?? 0) + weight);
    });

    // Get top 12 trending, then map to full Channel objects
    const trendingIds = Array.from(watchCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([id]) => id);

    return allChannels.filter((ch) => trendingIds.includes(ch.id));
  }, [allChannels, recentlyWatched]);

  if (trendingChannels.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp size={18} style={{ color: "var(--accent-gold)" }} />
        <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
          🔥 Trending Now
        </h2>
      </div>
      <ChannelGrid
        channels={trendingChannels.map((ch) => ({
          id: ch.id,
          name: ch.name,
          logoUrl: ch.logo_url,
        }))}
        onSelect={(card) => {
          const full = trendingChannels.find((ch) => ch.id === card.id);
          if (full) onSelect(full);
        }}
      />
    </div>
  );
}
