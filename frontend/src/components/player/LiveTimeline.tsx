"use client";

import { useCallback, useMemo } from "react";

type Props = {
  currentTime: number;
  duration: number;
  bufferedPct: number;
  isLive: boolean;
  onSeek?: (time: number) => void;
};

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSportsClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LiveTimeline({ currentTime, duration, bufferedPct, isLive, onSeek }: Props) {
  const hasFiniteDuration = Number.isFinite(duration) && duration > 0 && duration !== Infinity;
  const progressPct = useMemo(() => {
    if (hasFiniteDuration) return Math.min(100, (currentTime / duration) * 100);
    return Math.min(100, Math.max(bufferedPct, 8));
  }, [hasFiniteDuration, currentTime, duration, bufferedPct]);

  const timeLabel = useMemo(() => {
    if (hasFiniteDuration) {
      return `${formatSportsClock(currentTime)} / ${formatSportsClock(duration)}`;
    }
    return formatClock(currentTime);
  }, [hasFiniteDuration, currentTime, duration]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!onSeek || !hasFiniteDuration) return;
      onSeek(Number(e.target.value));
    },
    [onSeek, hasFiniteDuration]
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 sm:gap-1.5 sm:px-2">
      <div className="flex w-full min-w-0 items-center justify-center gap-1.5 sm:gap-2">
        <span
          className="live-badge-inline inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white sm:text-[9px]"
          aria-hidden
        >
          <span className="live-dot h-1 w-1 rounded-full bg-white" />
          LIVE
        </span>
        <span className="truncate text-[10px] font-semibold tabular-nums text-white/90 sm:text-xs" aria-live="polite">
          {timeLabel}
        </span>
      </div>

      <div className="relative w-full min-w-0 px-0.5">
        <input
          type="range"
          min={0}
          max={hasFiniteDuration ? duration : 100}
          value={hasFiniteDuration ? currentTime : progressPct}
          onChange={handleSeek}
          className="player-live-timeline w-full"
          aria-label={isLive ? "Live stream progress" : "Playback progress"}
          disabled={!hasFiniteDuration && !onSeek}
          style={{
            background: `linear-gradient(to right, #EF4444 ${progressPct}%, rgba(255,255,255,0.18) ${progressPct}%)`,
          }}
        />
      </div>
    </div>
  );
}
