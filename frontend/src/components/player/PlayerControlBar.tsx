"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Maximize, Minimize, Pause, Play, Settings } from "lucide-react";
import { LiveTimeline } from "./LiveTimeline";
import { PlayerSliderPopup } from "./PlayerSliderPopup";

type VolumeIconProps = { size?: number; className?: string };

type Props = {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  isFullscreen: boolean;
  settingsOpen: boolean;
  isLive: boolean;
  currentTime: number;
  duration: number;
  bufferedPct: number;
  VolumeIcon: React.ComponentType<VolumeIconProps>;
  onTogglePlay: () => void;
  onVolumeChange: (pct: number) => void;
  onOpenSettings: () => void;
  onToggleFullscreen: () => void;
  onSeek?: (time: number) => void;
};

export function PlayerControlBar({
  isPlaying,
  isMuted,
  volume,
  isFullscreen,
  settingsOpen,
  isLive,
  currentTime,
  duration,
  bufferedPct,
  VolumeIcon,
  onTogglePlay,
  onVolumeChange,
  onOpenSettings,
  onToggleFullscreen,
  onSeek,
}: Props) {
  const [volumeOpen, setVolumeOpen] = useState(false);
  const volumeBtnRef = useRef<HTMLButtonElement>(null);
  const volumePct = Math.round(volume * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="player-control-shell absolute inset-x-0 bottom-0 z-40 px-1.5 pb-1.5 sm:px-3 sm:pb-3"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="glass-player-bar-premium overflow-visible rounded-[20px]">
        <div className="flex min-w-0 max-w-full items-center gap-0 px-1 py-1.5 sm:gap-1 sm:px-2.5 sm:py-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay();
            }}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="player-control-btn player-control-btn-primary shrink-0"
          >
            {isPlaying ? <Pause size={22} aria-hidden /> : <Play size={22} fill="currentColor" aria-hidden />}
          </button>

          <div className="relative shrink-0">
            <button
              ref={volumeBtnRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setVolumeOpen((v) => !v);
              }}
              onMouseEnter={() => {
                if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
                  setVolumeOpen(true);
                }
              }}
              aria-label={isMuted ? "Unmute" : "Volume"}
              aria-expanded={volumeOpen}
              className="player-control-btn"
            >
              <VolumeIcon size={20} aria-hidden />
            </button>
            <PlayerSliderPopup
              type="volume"
              open={volumeOpen}
              value={volumePct}
              min={0}
              max={100}
              muted={isMuted}
              anchorRef={volumeBtnRef}
              onChange={onVolumeChange}
              onClose={() => setVolumeOpen(false)}
            />
          </div>

          <LiveTimeline
            currentTime={currentTime}
            duration={duration}
            bufferedPct={bufferedPct}
            isLive={isLive}
            onSeek={onSeek}
          />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            aria-label="Settings"
            aria-expanded={settingsOpen}
            className={`player-control-btn shrink-0 ${settingsOpen ? "player-control-btn-active" : ""}`}
          >
            <Settings size={18} aria-hidden />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFullscreen();
            }}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className={`player-control-btn shrink-0 ${isFullscreen ? "player-control-btn-active" : ""}`}
          >
            {isFullscreen ? <Minimize size={18} aria-hidden /> : <Maximize size={18} aria-hidden />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
