import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "live" | "upcoming" | "neutral";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  live: "bg-live-red/15 border-live-red/40 text-red-400 uppercase tracking-widest font-extrabold text-[10px]",
  upcoming: "bg-accent-cyan/10 border-accent-cyan/35 text-accent-cyan font-semibold text-[11px]",
  neutral: "bg-surface-elevated border-glass-border text-foreground-secondary font-medium text-[11px]",
};

export function Badge({ variant = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {variant === "live" ? (
        <span className="live-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-live-red" aria-hidden />
      ) : null}
      {children}
    </span>
  );
}
