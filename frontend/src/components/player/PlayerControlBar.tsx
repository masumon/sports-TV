"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Maximize, Minimize, Pause, Play, Settings, Sun } from "lucide-react";
import { LiveTimeline } from "./LiveTimeline";
import { PlayerSliderPopup } from "./PlayerSliderPopup";

type VolumeIconProps = { size?: number; className?: string };

type Props = {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  brightness: number;
  isFullscreen: boolean;
  settingsOpen: boolean;
  currentTime: number;
  duration: number;
  bufferedPct: number;
  VolumeIcon: React.ComponentType<VolumeIconProps>;
  onTogglePlay: () => void;
  onVolumeChange: (pct: number) => void;
  onBrightnessChange: (pct: number) => void;
  onOpenSettings: () => void;
  onToggleFullscreen: () => void;
  onSeek?: (time: number) => void;
};

export function PlayerControlBar({
  isPlaying,
  isMuted,
  volume,
  brightness,
  isFullscreen,
  settingsOpen,
  currentTime,
  duration,
  bufferedPct,
  VolumeIcon,
  onTogglePlay,
  onVolumeChange,
  onBrightnessChange,
  onOpenSettings,
  onToggleFullscreen,
  onSeek,
}: Props) {
  const [activePopup, setActivePopup] = useState<"volume" | "brightness" | null>(null);
  const volumeBtnRef = useRef<HTMLButtonElement>(null);
  const brightnessBtnRef = useRef<HTMLButtonElement>(null);

  const volumePct = Math.round(volume * 100);
  const openPopup = (type: "volume" | "brightness") => {
    setActivePopup((prev) => (prev === type ? null : type));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="player-control-shell absolute inset-x-0 bottom-0 z-40 px-1.5 pb-1.5 sm:px-3 sm:pb-3"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="glass-player-bar-premium overflow-visible rounded-[18px] sm:rounded-[22px]">
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
                openPopup("volume");
              }}
              onMouseEnter={() => {
                if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
                  setActivePopup("volume");
                }
              }}
              aria-label={isMuted ? "Unmute" : "Volume"}
              aria-expanded={activePopup === "volume"}
              className="player-control-btn"
            >
              <VolumeIcon size={20} aria-hidden />
            </button>
            <PlayerSliderPopup
              type="volume"
              open={activePopup === "volume"}
              value={volumePct}
              min={0}
              max={100}
              muted={isMuted}
              anchorRef={volumeBtnRef}
              onChange={onVolumeChange}
              onClose={() => setActivePopup(null)}
            />
          </div>

          <div className="relative shrink-0">
            <button
              ref={brightnessBtnRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openPopup("brightness");
              }}
              onMouseEnter={() => {
                if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
                  setActivePopup("brightness");
                }
              }}
              aria-label="Brightness"
              aria-expanded={activePopup === "brightness"}
              className="player-control-btn"
            >
              <Sun size={20} aria-hidden />
            </button>
            <PlayerSliderPopup
              type="brightness"
              open={activePopup === "brightness"}
              value={brightness}
              min={10}
              max={100}
              anchorRef={brightnessBtnRef}
              onChange={onBrightnessChange}
              onClose={() => setActivePopup(null)}
            />
          </div>

          <LiveTimeline
            currentTime={currentTime}
            duration={duration}
            bufferedPct={bufferedPct}
            isLive
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
