import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PillTabProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  icon?: ReactNode;
};

export const PillTab = forwardRef<HTMLButtonElement, PillTabProps>(function PillTab(
  { active = false, icon, className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2.5 text-xs font-medium transition-all duration-200 sm:px-5 sm:py-3 sm:text-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        active
          ? "glow-gold border-accent-gold bg-accent-gold/10 text-accent-gold font-semibold"
          : "border-glass-border bg-surface-elevated text-foreground-secondary hover:border-accent-cyan/25 hover:text-foreground",
        className,
      )}
      {...props}
    >
      {icon ? <span className="shrink-0 opacity-90">{icon}</span> : null}
      {children}
    </button>
  );
});
