"use client";

import { motion } from "framer-motion";
import { PlayCircle, Radio } from "lucide-react";
import { flagFromCountryName } from "@/components/channel/flagEmoji";
import type { Channel } from "@/lib/types";

type Props = {
  channel: Channel;
  active: boolean;
  onSelect: (c: Channel) => void;
  index: number;
};

export function ChannelCard({ channel, active, onSelect, index }: Props) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(channel)}
      className="interactive-card group relative w-full rounded-xl text-left transition-all"
      style={{
        background: active
          ? "linear-gradient(135deg, rgba(245,166,35,0.12) 0%, rgba(229,57,53,0.08) 100%)"
          : "var(--bg-card)",
        border: active
          ? "1px solid rgba(245,166,35,0.5)"
          : "1px solid rgba(255,255,255,0.06)",
        boxShadow: active
          ? "0 0 0 1px rgba(245,166,35,0.2), 0 8px 32px rgba(0,0,0,0.4)"
          : "0 2px 8px rgba(0,0,0,0.2)",
        padding: "12px",
      }}
      whileHover={{ y: -2, scale: 1.008 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.01, 0.4), duration: 0.2 }}
    >
      {/* Active indicator bar */}
      {active && (
        <div
          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
          style={{ background: "var(--primary-accent)" }}
        />
      )}

      <div className="flex items-center gap-3">
        {/* Logo / initial */}
        {channel.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.logo_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-black"
            style={{
              background: "linear-gradient(135deg, rgba(245,166,35,0.2), rgba(229,57,53,0.15))",
              border: "1px solid rgba(245,166,35,0.25)",
              color: "var(--primary-accent)",
            }}
          >
            {channel.name.slice(0, 2).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--text-main)" }}>
            {channel.name}
          </p>
          <p className="flex items-center gap-1.5 truncate text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            <span className="shrink-0" aria-hidden>
              {flagFromCountryName(channel.country)}
            </span>
            <span className="truncate">
              {channel.country} · {channel.language}
            </span>
          </p>
        </div>

        {/* Play icon */}
        {active ? (
          <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.4)" }}>
            <Radio size={14} style={{ color: "var(--primary-accent)" }} className="animate-pulse" />
          </div>
        ) : (
          <PlayCircle
            className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "var(--primary-accent)" }}
          />
        )}
      </div>

      {/* Tags */}
      <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px]">
        <span
          className="rounded-full px-2 py-0.5 font-medium"
          style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}
        >
          {channel.category}
        </span>
        <span
          className="rounded-full px-2 py-0.5 font-bold"
          style={{ background: "rgba(245,166,35,0.1)", color: "var(--primary-accent)" }}
        >
          {channel.quality_tag.toUpperCase()}
        </span>
        {channel.quality_tag.toLowerCase().includes("hd") && (
          <span className="rounded-full px-2 py-0.5 font-bold" style={{ background: "rgba(16,185,129,0.1)", color: "#10B981" }}>
            HD
          </span>
        )}
        {active && (
          <span className="live-badge ml-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
          </span>
        )}
      </div>
    </motion.button>
  );
}

