"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { BRAND } from "@/lib/branding";

interface LoadingStateProps {
  variant?: "spinner" | "skeleton" | "pulse" | "shimmer" | "brand";
  message?: string;
}

export function LoadingState({ variant = "spinner", message }: LoadingStateProps) {
  if (variant === "brand") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Image src={BRAND.logo.png} alt={BRAND.name} width={64} height={64} className="object-contain animate-pulse" />
        {message && <p className="text-sm" style={{ color: "var(--text-muted)" }}>{message}</p>}
      </div>
    );
  }

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
        <Image src={BRAND.logo.png} alt="" width={48} height={48} className="object-contain opacity-70" />
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
