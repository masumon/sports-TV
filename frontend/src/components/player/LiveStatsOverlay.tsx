"use client";

import { useState } from "react";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { cn } from "@/lib/cn";

export type LiveStatsOverlayProps = {
  homeTeam: string;
  awayTeam: string;
  homeScore?: string;
  awayScore?: string;
  period?: string;
  playerName?: string;
  playerStat?: string;
  venue?: string;
  format?: string;
  series?: string;
  className?: string;
  defaultVisible?: boolean;
};

function hasRealScore(home?: string, away?: string): boolean {
  if (!home && !away) return false;
  if (home === "—" || away === "—") return false;
  return Boolean(home?.trim() || away?.trim());
}

export function LiveStatsOverlay({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  period,
  playerName,
  playerStat,
  venue,
  format,
  series,
  className,
  defaultVisible = true,
}: LiveStatsOverlayProps) {
  const [visible, setVisible] = useState(defaultVisible);
  const showScore = hasRealScore(homeScore, awayScore);
  const showMatchInfo = Boolean(venue || format || series);
  const hasContent = showScore || Boolean(playerName) || showMatchInfo || Boolean(period);

  if (!hasContent) return null;

  return (
    <div className={cn("pointer-events-none absolute inset-0 z-10", className)}>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="pointer-events-auto absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-glass-border bg-surface-secondary/80 px-2.5 py-1 text-[10px] font-semibold text-foreground backdrop-blur-md transition hover:border-accent-cyan/40"
        aria-expanded={visible}
        aria-label={visible ? "Hide live stats" : "Show live stats"}
      >
        <BarChart3 size={12} aria-hidden />
        Stats
        {visible ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {visible ? (
        <div className="pointer-events-auto absolute inset-x-3 bottom-3 flex flex-col gap-2 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-xs sm:flex-col lg:bottom-4 lg:right-4 lg:left-auto lg:max-w-sm">
          {showScore ? (
            <GlassPanel padding="sm" className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Score</p>
              <div className="flex items-center justify-between gap-3 text-sm font-bold text-foreground">
                <span className="truncate">{homeTeam}</span>
                <span className="shrink-0 tabular-nums text-accent-cyan">
                  {homeScore} - {awayScore}
                </span>
                <span className="truncate text-right">{awayTeam}</span>
              </div>
              {period ? <p className="text-xs text-accent-cyan">{period}</p> : null}
            </GlassPanel>
          ) : period ? (
            <GlassPanel padding="sm">
              <p className="text-xs text-accent-cyan">{period}</p>
            </GlassPanel>
          ) : null}

          {playerName ? (
            <GlassPanel padding="sm" className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Player</p>
              <p className="text-sm font-semibold text-foreground">{playerName}</p>
              {playerStat ? <p className="text-xs text-accent-cyan">{playerStat}</p> : null}
            </GlassPanel>
          ) : null}

          {showMatchInfo ? (
            <GlassPanel padding="sm" className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">Match Info</p>
              {series ? <p className="text-xs text-foreground">{series}</p> : null}
              {format ? <p className="text-xs text-accent-cyan">{format}</p> : null}
              {venue ? <p className="text-xs text-foreground-muted">{venue}</p> : null}
            </GlassPanel>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
