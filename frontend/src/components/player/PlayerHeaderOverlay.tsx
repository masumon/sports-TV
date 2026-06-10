"use client";

import { ChevronLeft } from "lucide-react";

const DEFAULT_BRAND_LOGO = "/icons/abo-sports-tv-logo.png";

type Props = {
  programTitle: string;
  channelLogoUrl?: string | null;
  isFullscreen?: boolean;
  onExitFullscreen?: () => void;
};

export function PlayerHeaderOverlay({
  programTitle,
  channelLogoUrl,
  isFullscreen = false,
  onExitFullscreen,
}: Props) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}
    >
      <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-2">
        {isFullscreen && onExitFullscreen ? (
          <button
            type="button"
            onClick={onExitFullscreen}
            className="player-header-back flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold text-white"
            aria-label="Exit fullscreen"
          >
            <ChevronLeft size={16} aria-hidden />
            Back
          </button>
        ) : null}

        <div className="player-header-chip flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-2.5 py-1.5 sm:gap-2.5 sm:px-3 sm:py-2">
          <span
            className="live-badge-inline inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white sm:text-[10px]"
            aria-label="Live broadcast"
          >
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
            LIVE
          </span>

          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/95 sm:h-8 sm:w-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={channelLogoUrl || DEFAULT_BRAND_LOGO}
              alt=""
              className="h-6 w-6 object-contain sm:h-7 sm:w-7"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = DEFAULT_BRAND_LOGO;
              }}
            />
          </div>

          <p
            className="min-w-0 flex-1 truncate text-xs font-semibold text-white sm:text-sm"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}
            title={programTitle}
          >
            {programTitle}
          </p>
        </div>
      </div>

      <div
        className="player-header-brand pointer-events-none flex shrink-0 items-center rounded-xl px-2 py-1"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={DEFAULT_BRAND_LOGO}
          alt="ABO Sports TV"
          className="h-7 w-auto max-w-[88px] object-contain sm:h-8 sm:max-w-[104px]"
        />
      </div>
    </div>
  );
}
