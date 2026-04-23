"use client";

import Hls from "hls.js";
import { motion } from "framer-motion";
import {
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  RectangleEllipsis,
  Play,
  Tv,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type QualityOption = {
  label: string;
  value: number;
};

type PremiumPlayerProps = {
  streamUrl: string;
  title: string;
  isTheaterMode: boolean;
  onToggleTheaterMode: () => void;
  overlay?: React.ReactNode;
};

const HIDE_CONTROLS_AFTER_MS = 3000;

function formatQualityFromHeight(height: number): string {
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  return `${height}p`;
}

export default function PremiumPlayer({
  streamUrl,
  title,
  isTheaterMode,
  onToggleTheaterMode,
  overlay,
}: PremiumPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([{ label: "Auto", value: -1 }]);
  const [selectedQuality, setSelectedQuality] = useState(-1);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHideControls = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, HIDE_CONTROLS_AFTER_MS);
  }, [clearHideTimer, isPlaying]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    scheduleHideControls();
  }, [scheduleHideControls]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const cleanup = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };

    cleanup();
    setQualityOptions([{ label: "Auto", value: -1 }]);
    setSelectedQuality(-1);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levelMap = new Map<number, QualityOption>();
        hls.levels.forEach((level, idx) => {
          if (!level.height) return;
          if (!levelMap.has(level.height)) {
            levelMap.set(level.height, { label: formatQualityFromHeight(level.height), value: idx });
          }
        });
        const parsed = [...levelMap.entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([, option]) => option);
        setQualityOptions([{ label: "Auto", value: -1 }, ...parsed]);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setSelectedQuality(data.level);
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
    }

    return cleanup;
  }, [streamUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setIsPlaying(true);
      scheduleHideControls();
    };
    const onPause = () => {
      setIsPlaying(false);
      setShowControls(true);
      clearHideTimer();
    };
    const onVolumeChange = () => setIsMuted(video.muted);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVolumeChange);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVolumeChange);
    };
  }, [clearHideTimer, scheduleHideControls]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(
    () => () => {
      clearHideTimer();
      hlsRef.current?.destroy();
    },
    [clearHideTimer]
  );

  const togglePlayPause = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const changeQuality = useCallback((qualityLevel: number) => {
    setSelectedQuality(qualityLevel);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = qualityLevel;
    }
  }, []);

  const togglePictureInPicture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await video.requestPictureInPicture();
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  }, []);

  const currentQualityLabel = useMemo(() => {
    if (selectedQuality === -1) return "Auto";
    return qualityOptions.find((item) => item.value === selectedQuality)?.label ?? "Auto";
  }, [qualityOptions, selectedQuality]);

  return (
    <motion.div
      ref={containerRef}
      className={`player-shell relative overflow-hidden ${isTheaterMode ? "h-[75vh]" : "aspect-video"}`}
      onMouseMove={showControlsTemporarily}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        autoPlay
        playsInline
        muted={false}
        controls={false}
      />

      {overlay}

      <div className="pointer-events-none absolute left-4 top-4">
        <span className="rounded-full border border-rose-400/50 bg-rose-500/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          Live
        </span>
      </div>

      <motion.div
        className={`absolute inset-x-0 bottom-0 p-4 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="glass-panel rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-zinc-400">Now Playing</p>
              <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
            </div>
            <span className="rounded-md border border-zinc-500/40 bg-zinc-900/70 px-2 py-1 text-xs text-zinc-200">
              {currentQualityLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="control-btn" type="button" onClick={togglePlayPause} aria-label="Play or pause">
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button className="control-btn" type="button" onClick={toggleMute} aria-label="Mute toggle">
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <select
              className="quality-select"
              value={selectedQuality}
              onChange={(event) => changeQuality(Number(event.target.value))}
              aria-label="Select quality"
            >
              {qualityOptions.map((option) => (
                <option key={`${option.label}-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button className="control-btn" type="button" onClick={togglePictureInPicture} aria-label="PiP mode">
              <PictureInPicture2 size={18} />
            </button>
            <button className="control-btn" type="button" onClick={onToggleTheaterMode} aria-label="Theater mode">
              {isTheaterMode ? <RectangleEllipsis size={18} /> : <Tv size={18} />}
            </button>
            <button className="control-btn" type="button" onClick={toggleFullscreen} aria-label="Fullscreen toggle">
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
