"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { VideoControls } from "./VideoControls";

export type HeroVideoPlayerProps = {
  children?: ReactNode;
  isLive?: boolean;
  poster?: string | null;
  title?: string;
  overlay?: ReactNode;
  showDecorativeControls?: boolean;
  className?: string;
};

export function HeroVideoPlayer({
  children,
  isLive = true,
  poster,
  title,
  overlay,
  showDecorativeControls = false,
  className,
}: HeroVideoPlayerProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  useEffect(() => {
    revealControls();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [revealControls]);

  return (
    <div
      ref={shellRef}
      className={cn(
        "relative aspect-video overflow-hidden rounded-2xl border border-border-subtle bg-surface-secondary shadow-glass",
        className,
      )}
      onMouseMove={showDecorativeControls ? revealControls : undefined}
      onTouchStart={showDecorativeControls ? revealControls : undefined}
    >
      {isLive ? (
        <Badge variant="live" className="absolute left-3 top-3 z-20">
          LIVE NOW
        </Badge>
      ) : null}

      {overlay}

      {children ? (
        <div className="absolute inset-0">{children}</div>
      ) : poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt={title ?? "Video poster"} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-foreground-muted">
          {title ?? "Select a channel to play"}
        </div>
      )}

      {showDecorativeControls ? (
        <VideoControls
          playing
          muted={false}
          currentTime={42}
          duration={3600}
          visible={controlsVisible}
          onTogglePlay={() => revealControls()}
          onToggleMute={() => revealControls()}
          onSeek={() => revealControls()}
          onFullscreen={() => {
            shellRef.current?.requestFullscreen?.().catch(() => undefined);
            revealControls();
          }}
        />
      ) : null}
    </div>
  );
}
