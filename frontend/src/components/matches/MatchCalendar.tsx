"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type MatchCalendarProps = {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  datesWithMatches?: string[];
  locale?: "en" | "bn";
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
};

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

const DAY_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LABELS_BN = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি"];

export function MatchCalendar({
  selectedDate,
  onDateSelect,
  datesWithMatches = [],
  locale = "en",
  onPrevWeek,
  onNextWeek,
}: MatchCalendarProps) {
  const weekStart = startOfWeek(selectedDate);
  const matchSet = useMemo(() => new Set(datesWithMatches), [datesWithMatches]);
  const dayLabels = locale === "bn" ? DAY_LABELS_BN : DAY_LABELS_EN;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const monthLabel = selectedDate.toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-secondary p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrevWeek}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-glass-border text-foreground-muted transition hover:border-accent-cyan/40 hover:text-foreground"
          aria-label="Previous week"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-heading-2 font-bengali text-foreground">{monthLabel}</h2>
        <button
          type="button"
          onClick={onNextWeek}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-glass-border text-foreground-muted transition hover:border-accent-cyan/40 hover:text-foreground"
          aria-label="Next week"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          const key = toDateKey(day);
          const selected = toDateKey(selectedDate) === key;
          const hasMatch = matchSet.has(key);
          const isToday = toDateKey(new Date()) === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onDateSelect(day)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-all duration-200",
                selected
                  ? "glow-gold border-accent-gold bg-accent-gold/10 text-accent-gold"
                  : "border-glass-border bg-surface-elevated text-foreground-secondary hover:border-accent-cyan/30 hover:text-foreground",
              )}
              aria-pressed={selected}
              aria-label={day.toLocaleDateString()}
            >
              <span className="text-[10px] font-medium">{dayLabels[index]}</span>
              <span className={cn("text-sm font-bold tabular-nums", isToday && !selected && "text-accent-cyan")}>
                {day.getDate()}
              </span>
              {hasMatch ? (
                <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" aria-hidden />
              ) : (
                <span className="h-1.5 w-1.5" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
