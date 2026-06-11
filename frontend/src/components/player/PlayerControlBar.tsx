"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Maximize, Minimize, Pause, Play, Settings } from "lucide-react";
import { LiveTimeline } from "./LiveTimeline";

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
  const [volumeExpanded, setVolumeExpanded] = useState(false);
  const volumeGroupRef = useRef<HTMLDivElement>(null);
  const prevVolumeRef = useRef(80);
  const volumePct = Math.round(volume * 100);

  useEffect(() => {
    if (!volumeExpanded) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (volumeGroupRef.current?.contains(target)) return;
      setVolumeExpanded(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [volumeExpanded]);

  useEffect(() => {
    if (settingsOpen) setVolumeExpanded(false);
  }, [settingsOpen]);

  const handleVolumeIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const narrowTouch =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 639px) and (pointer: coarse)").matches;
    if (narrowTouch) {
      setVolumeExpanded((v) => !v);
      return;
    }
    if (isMuted || volumePct === 0) {
      onVolumeChange(prevVolumeRef.current > 0 ? prevVolumeRef.current : 80);
    } else {
      prevVolumeRef.current = volumePct;
      onVolumeChange(0);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="player-control-shell pointer-events-auto absolute inset-x-0 bottom-0 z-40 px-1.5 pb-1.5 sm:px-2.5 sm:pb-2.5"
      style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="glass-player-bar-premium overflow-hidden rounded-2xl sm:rounded-[20px]">
        <div className="player-control-bar-row">
          <div className="player-control-cluster shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePlay();
              }}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="player-control-btn player-control-btn-primary"
            >
              {isPlaying ? <Pause size={20} aria-hidden /> : <Play size={20} fill="currentColor" aria-hidden />}
            </button>

            <div
              ref={volumeGroupRef}
              className={`player-volume-group${volumeExpanded ? " is-open" : ""}`}
            >
              <button
                type="button"
                onClick={handleVolumeIconClick}
                aria-label={isMuted || volumePct === 0 ? "Unmute" : "Volume"}
                aria-expanded={volumeExpanded}
                className={`player-control-btn${volumeExpanded ? " player-control-btn-active" : ""}`}
              >
                <VolumeIcon size={18} aria-hidden />
              </button>
              <div className="player-volume-slider-wrap" onClick={(e) => e.stopPropagation()}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volumePct}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (next > 0) prevVolumeRef.current = next;
                    onVolumeChange(next);
                  }}
                  className="player-volume-slider"
                  aria-label="Volume"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={isMuted ? 0 : volumePct}
                  style={{
                    background: `linear-gradient(to right, #F5A623 ${isMuted ? 0 : volumePct}%, rgba(255,255,255,0.16) ${isMuted ? 0 : volumePct}%)`,
                  }}
                />
              </div>
            </div>
          </div>

          <LiveTimeline
            currentTime={currentTime}
            duration={duration}
            bufferedPct={bufferedPct}
            isLive={isLive}
            onSeek={onSeek}
            compact={volumeExpanded}
          />

          <div className="player-control-cluster shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSettings();
              }}
              aria-label="Settings"
              aria-expanded={settingsOpen}
              className={`player-control-btn${settingsOpen ? " player-control-btn-active" : ""}`}
            >
              <Settings size={17} aria-hidden />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFullscreen();
              }}
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className={`player-control-btn${isFullscreen ? " player-control-btn-active" : ""}`}
            >
              {isFullscreen ? <Minimize size={17} aria-hidden /> : <Maximize size={17} aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
