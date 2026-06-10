import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "outline" | "ghost" | "reminder";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-gold text-surface border border-accent-gold font-semibold shadow-glow-gold hover:brightness-110",
  outline:
    "border border-accent-cyan/40 text-foreground bg-transparent hover:bg-surface-elevated hover:border-accent-cyan/60 hover:shadow-glow-cyan",
  ghost:
    "border border-transparent text-foreground-secondary bg-transparent hover:bg-surface-elevated hover:text-foreground",
  reminder:
    "border border-accent-gold/60 text-accent-gold bg-accent-gold/5 hover:bg-accent-gold/10 hover:border-accent-gold font-semibold",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs rounded-lg",
  md: "h-10 gap-2 px-4 text-sm rounded-xl",
  lg: "h-12 gap-2.5 px-6 text-base rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    icon,
    iconPosition = "left",
    className,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  const reminderIcon = variant === "reminder" && !icon ? <Bell size={size === "sm" ? 14 : 16} aria-hidden /> : icon;

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {reminderIcon && iconPosition === "left" ? reminderIcon : null}
      {children}
      {reminderIcon && iconPosition === "right" ? reminderIcon : null}
    </button>
  );
});
