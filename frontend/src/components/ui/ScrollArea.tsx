import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ScrollAreaProps = HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
};

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { orientation = "horizontal", className, children, ...props },
  ref,
) {
  const isHorizontal = orientation === "horizontal";

  return (
    <div
      ref={ref}
      className={cn(
        "scrollbar-none",
        isHorizontal
          ? "flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain"
          : "flex snap-y snap-mandatory flex-col gap-2 overflow-y-auto overscroll-y-contain",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
