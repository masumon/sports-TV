"use client";

import { motion } from "framer-motion";
import { PlayCircle } from "lucide-react";

import type { Channel } from "@/lib/types";

type ChannelGridProps = {
  channels: Channel[];
  activeChannelId: number | null;
  onSelectChannel: (channel: Channel) => void;
};

export default function ChannelGrid({
  channels,
  activeChannelId,
  onSelectChannel,
}: ChannelGridProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0c1324]/80 p-4 shadow-2xl backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">লাইভ স্পোর্টস চ্যানেল</h2>
        <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
          মোট {channels.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map((channel, idx) => {
          const isActive = activeChannelId === channel.id;
          return (
            <motion.button
              key={channel.id}
              type="button"
              onClick={() => onSelectChannel(channel)}
              className={`group relative rounded-xl border px-3 py-3 text-left transition ${
                isActive
                  ? "border-cyan-400/70 bg-cyan-500/20"
                  : "border-white/10 bg-slate-900/60 hover:border-cyan-400/30 hover:bg-slate-800/80"
              }`}
              whileHover={{ y: -2, scale: 1.01 }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03, duration: 0.2 }}
            >
              <div className="flex items-center gap-3">
                {channel.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={channel.logo_url}
                    alt={channel.name}
                    className="h-11 w-11 rounded-lg border border-white/10 object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-slate-800 text-slate-300">
                    {channel.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">{channel.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {channel.country} • {channel.language}
                  </p>
                </div>
                <PlayCircle
                  className={`h-5 w-5 ${
                    isActive ? "text-cyan-200" : "text-slate-500 group-hover:text-cyan-300"
                  }`}
                />
              </div>

              <div className="mt-3 flex items-center gap-2 text-[11px]">
                <span className="rounded-full bg-slate-700/60 px-2 py-1 text-slate-300">
                  {channel.category}
                </span>
                <span className="rounded-full bg-slate-700/60 px-2 py-1 text-slate-300">
                  {channel.quality_tag.toUpperCase()}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
