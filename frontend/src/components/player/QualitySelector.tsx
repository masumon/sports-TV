"use client";

import { Settings } from "lucide-react";
import { useState } from "react";

type QualitySelectorProps = {
  options: { label: string; value: number }[];
  selected: number;
  onSelect: (value: number) => void;
};

export function QualitySelector({ options, selected, onSelect }: QualitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (options.length <= 1) return null;

  const selectedLabel = options.find((o) => o.value === selected)?.label ?? "Auto";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:bg-white/10"
        style={{
          background: isOpen ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
          color: "var(--text-main)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}
        aria-label="Select video quality"
      >
        <Settings size={12} />
        <span>{selectedLabel}</span>
      </button>

      {isOpen && (
        <div
          className="glass-player-bar-premium absolute right-0 top-full z-50 mt-2 rounded-lg overflow-hidden border border-border-subtle min-w-[120px]"
          style={{
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onSelect(opt.value);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-xs font-medium transition hover:bg-white/10"
              style={{
                color: selected === opt.value ? "var(--accent-gold)" : "var(--text-muted)",
                background: selected === opt.value ? "rgba(245,166,35,0.1)" : "transparent",
              }}
            >
              {selected === opt.value && <span className="mr-2">✓</span>}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
