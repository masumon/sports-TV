"use client";

import { motion } from "framer-motion";
import { PlayCircle } from "lucide-react";
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
      className={`group relative w-full rounded-xl border px-3 py-3 text-left transition ${
        active
          ? "border-cyan-400/70 bg-cyan-500/15 shadow-lg shadow-cyan-500/10"
          : "border-white/10 bg-slate-900/50 hover:border-cyan-400/30 hover:bg-slate-800/80"
      } `}
      whileHover={{ y: -2, scale: 1.01 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.01, 0.4), duration: 0.2 }}
    >
      <div className="flex items-center gap-3">
        {channel.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.logo_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg border border-white/10 object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-800 text-sm font-bold text-slate-300">
            {channel.name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100">{channel.name}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-slate-400">
            <span className="shrink-0" aria-hidden>
              {flagFromCountryName(channel.country)}
            </span>
            <span>
              {channel.country} · {channel.language}
            </span>
          </p>
        </div>
        <PlayCircle className={`h-5 w-5 shrink-0 ${active ? "text-cyan-200" : "text-slate-500 group-hover:text-cyan-300"}`} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
        <span className="rounded-full bg-slate-800/90 px-2 py-0.5 text-slate-300">{channel.category}</span>
        <span className="rounded-full bg-slate-800/90 px-2 py-0.5 text-amber-200/90">{channel.quality_tag.toUpperCase()}</span>
        {channel.quality_tag.toLowerCase().includes("hd") ? (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300">HD</span>
        ) : null}
      </div>
    </motion.button>
  );
}
