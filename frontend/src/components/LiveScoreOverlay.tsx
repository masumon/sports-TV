"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";

export type LiveScoreItem = {
  id: number;
  sport_type: "football" | "cricket";
  league: string;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  match_minute: string | null;
  status: "upcoming" | "live" | "finished";
  extra_data: string | null;
};

type LiveScoreOverlayProps = {
  scores: LiveScoreItem[];
};

function statusBadge(status: LiveScoreItem["status"]) {
  if (status === "live") return "LIVE";
  if (status === "upcoming") return "UPCOMING";
  return "FT";
}

export default function LiveScoreOverlay({ scores }: LiveScoreOverlayProps) {
  const filtered = scores
    .filter((item) => item.status === "live" || item.status === "upcoming")
    .slice(0, 3);
  if (filtered.length === 0) return null;

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-20 w-full max-w-md space-y-2">
      {filtered.map((score, index) => (
        <motion.div
          key={score.id}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08, duration: 0.25 }}
          className="rounded-xl border border-white/20 bg-slate-950/55 p-3 backdrop-blur-md"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-200">
              <Trophy size={14} className="text-emerald-300" />
              {score.league}
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                score.status === "live"
                  ? "bg-red-500/80 text-white"
                  : "bg-slate-700/80 text-slate-100"
              }`}
            >
              {statusBadge(score.status)}
            </span>
          </div>

          <div className="space-y-1 text-sm text-slate-100">
            <div className="flex items-center justify-between">
              <span>{score.team_home}</span>
              <span className="font-bold">{score.score_home}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{score.team_away}</span>
              <span className="font-bold">{score.score_away}</span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
            <span>{score.match_minute || (score.status === "upcoming" ? "Starting soon" : "Final")}</span>
            {score.extra_data ? <span className="truncate pl-3">{score.extra_data}</span> : null}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
