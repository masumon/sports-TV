import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  padding?: "none" | "sm" | "md" | "lg";
};

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  { padding = "md", className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "glass-panel rounded-2xl backdrop-blur-xl",
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
