"use client";

import { Globe, Radio, Zap } from "lucide-react";
import type { Channel } from "@/lib/types";

type ChannelDetailsPanelProps = {
  channel: Channel | null;
  onClose?: () => void;
};

export function ChannelDetailsPanel({ channel, onClose }: ChannelDetailsPanelProps) {
  if (!channel) return null;

  return (
    <div className="glass-player-bar-premium rounded-xl border border-border-subtle p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-sm text-foreground">{channel.name}</h3>
          <p className="text-xs text-muted-foreground mt-1">{channel.category}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xs font-medium"
            aria-label="Close details"
          >
            ✕
          </button>
        )}
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Globe size={14} />
          <span>{channel.country || "Global"}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Radio size={14} />
          <span>{channel.language || "Unknown"}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Zap size={14} />
          <span className="capitalize">{channel.quality_tag || "auto"}</span>
        </div>
      </div>

      {channel.geo_hint && (
        <div className="rounded px-2 py-1 bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-300">
          VPN may be required for this channel
        </div>
      )}
    </div>
  );
}
