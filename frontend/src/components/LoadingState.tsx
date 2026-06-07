"use client";

import { motion } from "framer-motion";

interface LoadingStateProps {
  variant?: "spinner" | "skeleton" | "pulse" | "shimmer";
  message?: string;
}

export function LoadingState({ variant = "spinner", message }: LoadingStateProps) {
  if (variant === "spinner") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="loading-spin" aria-hidden />
        {message && <p className="text-sm" style={{ color: "var(--text-muted)" }}>{message}</p>}
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div className="space-y-4 py-8">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="skeleton-shimmer h-20 rounded-lg"
            style={{ opacity: 1 - i * 0.15 }}
          />
        ))}
      </div>
    );
  }

  if (variant === "pulse") {
    return (
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="flex items-center justify-center py-8"
      >
        <div className="h-8 w-8 rounded-full" style={{ background: "var(--primary-accent)", opacity: 0.3 }} />
      </motion.div>
    );
  }

  if (variant === "shimmer") {
    return (
      <div className="space-y-3 py-6">
        <div className="skeleton-shimmer h-12 w-full rounded-lg" />
        <div className="skeleton-shimmer h-12 w-5/6 rounded-lg" />
        <div className="skeleton-shimmer h-12 w-4/5 rounded-lg" />
      </div>
    );
  }

  return null;
}
