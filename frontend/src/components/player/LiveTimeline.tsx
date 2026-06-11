"use client";

import { useCallback, useMemo } from "react";

type Props = {
  currentTime: number;
  duration: number;
  bufferedPct: number;
  isLive: boolean;
  onSeek?: (time: number) => void;
  compact?: boolean;
};

function formatSportsClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LiveTimeline({ currentTime, duration, isLive, onSeek, compact = false }: Props) {
  const hasFiniteDuration = Number.isFinite(duration) && duration > 0 && duration !== Infinity;
  const showVodTimeline = !isLive && hasFiniteDuration;

  const progressPct = useMemo(() => {
    if (!showVodTimeline) return 0;
    return Math.min(100, (currentTime / duration) * 100);
  }, [showVodTimeline, currentTime, duration]);

  const timeLabel = useMemo(() => {
    if (!showVodTimeline) return null;
    return `${formatSportsClock(currentTime)} / ${formatSportsClock(duration)}`;
  }, [showVodTimeline, currentTime, duration]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!onSeek || !showVodTimeline) return;
      onSeek(Number(e.target.value));
    },
    [onSeek, showVodTimeline]
  );

  if (isLive) {
    if (compact) {
      return <div className="min-w-0 flex-1" aria-hidden />;
    }
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center px-0.5 sm:px-2">
        <span
          className="live-badge-inline inline-flex max-w-full shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[10px]"
          aria-label="Live broadcast"
        >
          <span className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-white" aria-hidden />
          <span className="truncate">LIVE</span>
        </span>
      </div>
    );
  }

  if (!showVodTimeline) {
    return <div className="min-w-0 flex-1" aria-hidden />;
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 sm:gap-1.5 sm:px-2">
      <div className="flex w-full min-w-0 items-center justify-center">
        <span className="truncate text-[10px] font-semibold tabular-nums text-white/90 sm:text-xs" aria-live="polite">
          {timeLabel}
        </span>
      </div>

      <div className="relative w-full min-w-0 px-0.5">
        <input
          type="range"
          min={0}
          max={duration}
          value={currentTime}
          onChange={handleSeek}
          className="player-live-timeline w-full"
          aria-label="Playback progress"
          style={{
            background: `linear-gradient(to right, #EF4444 ${progressPct}%, rgba(255,255,255,0.18) ${progressPct}%)`,
          }}
        />
      </div>
    </div>
  );
}
