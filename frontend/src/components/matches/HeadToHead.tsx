import { MapPin, Users } from "lucide-react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { cn } from "@/lib/cn";

export type TeamForm = "W" | "L" | "D";

export type HeadToHeadProps = {
  homeTeam: string;
  awayTeam: string;
  homeForm?: TeamForm[];
  awayForm?: TeamForm[];
  stadium?: string;
  city?: string;
  capacity?: string;
  homeWins?: number;
  awayWins?: number;
  draws?: number;
  className?: string;
};

function FormPill({ result }: { result: TeamForm }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold",
        result === "W" && "bg-accent-neon/15 text-accent-neon",
        result === "L" && "bg-live-red/15 text-red-400",
        result === "D" && "bg-surface-elevated text-foreground-muted",
      )}
    >
      {result}
    </span>
  );
}

export function HeadToHead({
  homeTeam,
  awayTeam,
  homeForm = [],
  awayForm = [],
  stadium,
  city,
  capacity,
  homeWins = 0,
  awayWins = 0,
  draws = 0,
  className,
}: HeadToHeadProps) {
  const total = homeWins + awayWins + draws;

  return (
    <section className={cn("space-y-4", className)}>
      <h2 className="text-heading-2 text-foreground">Head to Head</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassPanel className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Home</p>
          <p className="text-lg font-bold text-foreground">{homeTeam}</p>
          <div className="flex gap-1.5">
            {homeForm.map((r, i) => (
              <FormPill key={`${r}-${i}`} result={r} />
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Away</p>
          <p className="text-lg font-bold text-foreground">{awayTeam}</p>
          <div className="flex gap-1.5">
            {awayForm.map((r, i) => (
              <FormPill key={`${r}-${i}`} result={r} />
            ))}
          </div>
        </GlassPanel>
      </div>

      {(stadium || city || capacity) ? (
        <GlassPanel className="flex items-start gap-3">
          <MapPin size={18} className="mt-0.5 shrink-0 text-accent-cyan" aria-hidden />
          <div>
            <p className="font-semibold text-foreground">{stadium ?? "Stadium TBD"}</p>
            {city ? <p className="text-sm text-foreground-secondary">{city}</p> : null}
            {capacity ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground-muted">
                <Users size={12} aria-hidden />
                Capacity: {capacity}
              </p>
            ) : null}
          </div>
        </GlassPanel>
      ) : null}

      {total > 0 ? (
        <GlassPanel className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Last meetings: {total}</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-surface-elevated p-2">
              <p className="font-bold text-accent-gold">{homeWins}</p>
              <p className="text-foreground-muted">{homeTeam}</p>
            </div>
            <div className="rounded-xl bg-surface-elevated p-2">
              <p className="font-bold text-foreground">{draws}</p>
              <p className="text-foreground-muted">Draws</p>
            </div>
            <div className="rounded-xl bg-surface-elevated p-2">
              <p className="font-bold text-accent-cyan">{awayWins}</p>
              <p className="text-foreground-muted">{awayTeam}</p>
            </div>
          </div>
        </GlassPanel>
      ) : null}
    </section>
  );
}
