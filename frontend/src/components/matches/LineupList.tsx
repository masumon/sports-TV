import { GlassPanel } from "@/components/ui/GlassPanel";
import { cn } from "@/lib/cn";

export type LineupPlayer = {
  number: number | string;
  name: string;
  role?: "bat" | "bowl" | "keeper" | "allrounder";
  isCaptain?: boolean;
  isKeeper?: boolean;
};

export type TeamLineup = {
  team: string;
  startingXI: LineupPlayer[];
  substitutes?: LineupPlayer[];
};

type LineupListProps = {
  home: TeamLineup;
  away: TeamLineup;
  className?: string;
};

function roleLabel(role?: LineupPlayer["role"]): string {
  if (role === "bat") return "BAT";
  if (role === "bowl") return "BWL";
  if (role === "keeper") return "WK";
  if (role === "allrounder") return "AR";
  return "";
}

function LineupColumn({ lineup }: { lineup: TeamLineup }) {
  return (
    <GlassPanel className="space-y-4">
      <h3 className="text-heading-3 text-foreground">{lineup.team}</h3>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Starting XI</p>
        <ul className="space-y-1">
          {lineup.startingXI.map((player) => (
            <li
              key={`${player.number}-${player.name}`}
              className="flex items-center gap-2 border-b border-glass-border py-2 last:border-0"
            >
              <span className="w-6 text-xs font-bold tabular-nums text-accent-cyan">{player.number}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{player.name}</span>
              {player.isCaptain ? (
                <span className="rounded px-1.5 py-0.5 text-[9px] font-bold text-accent-gold">C</span>
              ) : null}
              {player.isKeeper ? (
                <span className="rounded px-1.5 py-0.5 text-[9px] font-bold text-accent-cyan">WK</span>
              ) : null}
              {player.role ? (
                <span className="text-[10px] text-foreground-muted">{roleLabel(player.role)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {lineup.substitutes && lineup.substitutes.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Substitutes</p>
          <ul className="space-y-1">
            {lineup.substitutes.map((player) => (
              <li key={`sub-${player.number}-${player.name}`} className="flex items-center gap-2 py-1.5 text-sm text-foreground-secondary">
                <span className="w-6 text-xs tabular-nums">{player.number}</span>
                <span className="truncate">{player.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </GlassPanel>
  );
}

export function LineupList({ home, away, className }: LineupListProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <h2 className="text-heading-2 text-foreground">Lineups</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <LineupColumn lineup={home} />
        <LineupColumn lineup={away} />
      </div>
    </section>
  );
}
