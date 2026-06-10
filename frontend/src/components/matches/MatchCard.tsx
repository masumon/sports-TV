"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { LiveFixture } from "@/lib/types";

export type MatchCardProps = {
  match: LiveFixture;
  isLive?: boolean;
  stadium?: string;
  format?: string;
  onSetReminder?: (match: LiveFixture) => void;
  className?: string;
};

function teamFlag(team: string): string {
  const t = team.toLowerCase();
  if (t.includes("bangladesh") || t.includes("bd")) return "🇧🇩";
  if (t.includes("india")) return "🇮🇳";
  if (t.includes("pakistan")) return "🇵🇰";
  if (t.includes("england")) return "🏴";
  return "🏳️";
}

export function MatchCard({ match, isLive = false, stadium, format, onSetReminder, className }: MatchCardProps) {
  const start = match.starts_at_utc
    ? new Date(match.starts_at_utc).toLocaleString(undefined, {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "TBD";

  return (
    <article
      className={cn(
        "relative rounded-2xl border border-border-subtle bg-surface-secondary p-4 transition-all duration-200 hover:border-accent-cyan/25",
        isLive && "neon-border",
        className,
      )}
    >
      {isLive ? (
        <Badge variant="live" className="absolute right-3 top-3">
          LIVE
        </Badge>
      ) : null}

      <div className="flex items-center justify-between gap-3 pr-16">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-xl" aria-hidden>{teamFlag(match.home_team)}</span>
          <span className="truncate text-sm font-semibold text-foreground">{match.home_team}</span>
        </div>
        <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-foreground-muted">vs</span>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="truncate text-right text-sm font-semibold text-foreground">{match.away_team}</span>
          <span className="text-xl" aria-hidden>{teamFlag(match.away_team)}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
        <span>{start}</span>
        {format ? <span className="rounded-full bg-accent-cyan/10 px-2 py-0.5 text-accent-cyan">{format}</span> : null}
        {match.sport ? <span>{match.sport}</span> : null}
      </div>

      {stadium ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-foreground-secondary">
          <MapPin size={12} className="shrink-0 text-accent-cyan" aria-hidden />
          {stadium}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <Button variant="reminder" size="sm" onClick={() => onSetReminder?.(match)}>
          Set Reminder
        </Button>
        <Link
          href={`/match/${match.id}` as `/match/${string}`}
          className="text-xs font-semibold text-accent-cyan transition hover:text-accent-gold"
        >
          Match details →
        </Link>
      </div>
    </article>
  );
}
