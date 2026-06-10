"use client";

import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/cn";

export type VideoControlsProps = {
  playing: boolean;
  muted: boolean;
  currentTime: number;
  duration: number;
  visible: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onSeek: (time: number) => void;
  onFullscreen: () => void;
  className?: string;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoControls({
  playing,
  muted,
  currentTime,
  duration,
  visible,
  onTogglePlay,
  onToggleMute,
  onSeek,
  onFullscreen,
  className,
}: VideoControlsProps) {
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className={cn(
        "glass-player-bar absolute inset-x-0 bottom-0 z-20 mx-2 mb-2 rounded-2xl px-3 pb-3 pt-8 transition-opacity duration-200 sm:mx-3 sm:px-4",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
    >
      <input
        type="range"
        min={0}
        max={duration || 100}
        value={currentTime}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="hero-progress mb-3 h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-accent-gold"
        aria-label="Seek"
        style={{
          background: `linear-gradient(to right, var(--accent-gold) ${progress}%, rgba(255,255,255,0.15) ${progress}%)`,
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-white transition hover:border-accent-gold hover:text-accent-gold"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-white transition hover:border-accent-gold hover:text-accent-gold"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <span className="text-xs tabular-nums text-white/80">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <button
          type="button"
          onClick={onFullscreen}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-white transition hover:border-accent-gold hover:text-accent-gold"
          aria-label="Fullscreen"
        >
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
}
