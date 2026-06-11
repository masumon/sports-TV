"use client";

import { Radio } from "lucide-react";

type GoLiveButtonProps = {
  liveChannelCount: number;
  onJumpToLive: () => void;
  isVisible?: boolean;
};

export function GoLiveButton({ liveChannelCount, onJumpToLive, isVisible = true }: GoLiveButtonProps) {
  if (!isVisible || liveChannelCount === 0) return null;

  return (
    <button
      type="button"
      onClick={onJumpToLive}
      className="fixed bottom-6 right-6 z-40 md:bottom-8 md:right-8 animate-pulse rounded-full px-4 py-3 font-bold text-sm transition hover:scale-110 active:scale-95"
      style={{
        background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
        color: "white",
        boxShadow: "0 8px 24px rgba(239, 68, 68, 0.4)",
      }}
      aria-label={`Jump to Live (${liveChannelCount} channels)`}
    >
      <div className="flex items-center gap-2">
        <Radio size={16} className="animate-spin" />
        <span className="hidden sm:inline">Live</span>
        <span className="inline sm:hidden">🔴</span>
        <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">{liveChannelCount}</span>
      </div>
    </button>
  );
}
