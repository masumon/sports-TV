"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Volume2, VolumeX } from "lucide-react";

type Props = {
  type: "volume" | "brightness";
  open: boolean;
  value: number;
  min: number;
  max: number;
  muted?: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onChange: (value: number) => void;
  onClose: () => void;
};

export function PlayerSliderPopup({
  type,
  open,
  value,
  min,
  max,
  muted = false,
  anchorRef,
  onChange,
  onClose,
}: Props) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popupRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const Icon = type === "brightness" ? Sun : muted || value === 0 ? VolumeX : Volume2;
  const label = type === "brightness" ? "Brightness" : muted ? "Muted" : "Volume";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={popupRef}
          role="dialog"
          aria-label={`${label} control`}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.96 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="player-slider-popup absolute bottom-full left-1/2 z-50 mb-2 flex -translate-x-1/2 flex-col items-center gap-2 rounded-2xl px-3 py-3"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon size={18} className="text-white/90" aria-hidden />
          <div className="player-slider-track relative flex h-28 w-8 items-center justify-center">
            <input
              type="range"
              min={min}
              max={max}
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              className="player-vertical-slider"
              aria-label={label}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={value}
              style={{
                background: `linear-gradient(to top, #EF4444 ${pct}%, rgba(255,255,255,0.12) ${pct}%)`,
              }}
            />
          </div>
          <span className="text-[10px] font-bold tabular-nums text-white/80">{value}%</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
