"use client";

import { motion } from "framer-motion";
import { Activity, ShieldCheck, Tv2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ChannelGrid from "@/components/ChannelGrid";
import LiveScoreOverlay from "@/components/LiveScoreOverlay";
import PremiumPlayer from "@/components/PremiumPlayer";
import { apiClient } from "@/lib/apiClient";
import type { Channel, ChannelListResponse, LiveScore } from "@/lib/types";
import { usePlayerStore } from "@/store/playerStore";

export default function HomePage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<LiveScore[]>([]);

  const activeChannel = usePlayerStore((state) => state.activeChannel);
  const isTheaterMode = usePlayerStore((state) => state.isTheaterMode);
  const setActiveChannel = usePlayerStore((state) => state.setActiveChannel);
  const toggleTheaterMode = usePlayerStore((state) => state.toggleTheaterMode);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const channelData = await apiClient.getChannels({ page: 1, page_size: 48 });
        setChannels(channelData.items);
        if (channelData.items.length > 0 && !activeChannel) {
          setActiveChannel(channelData.items[0]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load channels.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    void bootstrap();
  }, [activeChannel, setActiveChannel]);

  useEffect(() => {
    const pullScores = async () => {
      try {
        const scoreData = await apiClient.getLiveScores(undefined, 8);
        setScores(scoreData);
      } catch {
        // Keep UI stable even if score API is temporarily down.
      }
    };
    void pullScores();
    const interval = setInterval(() => void pullScores(), 15000);
    return () => clearInterval(interval);
  }, []);

  const statusText = useMemo(() => {
    if (loading) return "চ্যানেল লোড হচ্ছে...";
    if (error) return error;
    return `${channels.length}টি লাইভ চ্যানেল পাওয়া গেছে`;
  }, [loading, error, channels.length]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-sky-300/80">Global Sports Live TV</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">
              বিশ্বজুড়ে লাইভ স্পোর্টস স্ট্রিমিং প্ল্যাটফর্ম
            </h1>
            <p className="mt-2 text-sm text-slate-300">{statusText}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge icon={<Tv2 size={14} />} label="Premium Stream Player" />
            <Badge icon={<Activity size={14} />} label="Real-time Score Overlay" />
            <Badge icon={<ShieldCheck size={14} />} label="JWT Secured Admin" />
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-8"
        >
          {activeChannel ? (
            <PremiumPlayer
              streamUrl={activeChannel.stream_url}
              title={activeChannel.name}
              isTheaterMode={isTheaterMode}
              onToggleTheaterMode={toggleTheaterMode}
              overlay={<LiveScoreOverlay scores={scores} />}
            />
          ) : (
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-6 text-sm text-slate-300">
              কোনো চ্যানেল সিলেক্ট করা হয়নি।
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Sports Channel Directory</h2>
            <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
              Tap a channel to play
            </span>
          </div>
          <ChannelGrid
            channels={channels}
            activeChannelId={activeChannel?.id ?? null}
            onSelectChannel={setActiveChannel}
          />
        </motion.section>
      </div>
    </main>
  );
}

function Badge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-200">
      <span className="text-sky-300">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
