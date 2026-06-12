"use client";

import { AlertCircle, X } from "lucide-react";
import type { Channel } from "@/lib/types";

type ChannelDetailsPanelProps = {
  channel: Channel | null;
  onClose?: () => void;
};

export function ChannelDetailsPanel({ channel, onClose }: ChannelDetailsPanelProps) {
  if (!channel) return null;

  return (
    <div className="glass-player-bar-premium rounded-xl border border-border-subtle p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-base text-foreground truncate">{channel.name}</h3>
          <p className="text-xs text-muted-foreground mt-1.5">{channel.category}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 text-muted-foreground hover:text-foreground transition p-1 -m-1"
            aria-label="Close details"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1.5 px-2 py-2 rounded-lg bg-white/[0.02] border border-border-subtle/50">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Quality</span>
          <span className="text-xs font-bold text-foreground capitalize">{channel.quality_tag ? channel.quality_tag.replace("_", " ") : "Auto"}</span>
        </div>
        <div className="flex flex-col gap-1.5 px-2 py-2 rounded-lg bg-white/[0.02] border border-border-subtle/50">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Language</span>
          <span className="text-xs font-bold text-foreground">{channel.language || "—"}</span>
        </div>
        <div className="flex flex-col gap-1.5 px-2 py-2 rounded-lg bg-white/[0.02] border border-border-subtle/50">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Country</span>
          <span className="text-xs font-bold text-foreground">{channel.country || "Global"}</span>
        </div>
      </div>

      {/* Alert for geo-restriction */}
      {channel.geo_hint && (
        <div className="flex items-start gap-2.5 rounded-lg px-3 py-2.5" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: "#818cf8" }} />
          <p className="text-xs" style={{ color: "rgba(199,210,254,0.9)" }}>
            এই চ্যানেলে VPN প্রয়োজন হতে পারে
          </p>
        </div>
      )}

      {/* Status info */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]" style={{ background: "rgba(245,166,35,0.05)", borderLeft: "2px solid rgba(245,166,35,0.4)" }}>
        <span className="inline-block h-2 w-2 rounded-full animate-pulse" style={{ background: "#f87171" }} />
        <span style={{ color: "rgba(245,166,35,0.8)" }}>লাইভ স্ট্রিম প্রস্তুত</span>
      </div>
    </div>
  );
}
