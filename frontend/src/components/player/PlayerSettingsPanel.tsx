"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  dataSaver: boolean;
  onDataSaverChange: (v: boolean) => void;
  selectedQuality: number;
  qualityOptions: { label: string; value: number }[];
  onQualityChange: (v: number) => void;
  showStreamHealth: boolean;
  onToggleStreamHealth: (v: boolean) => void;
  streamHealth: { bitrate: string; level: string; urlIndex: number; totalUrls: number };
  aspectRatio: "cover" | "contain";
  onAspectRatioChange: (v: "cover" | "contain") => void;
};

export function PlayerSettingsPanel({
  open,
  onClose,
  dataSaver,
  onDataSaverChange,
  selectedQuality,
  qualityOptions,
  onQualityChange,
  showStreamHealth,
  onToggleStreamHealth,
  streamHealth,
  aspectRatio,
  onAspectRatioChange,
}: Props) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-3"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          className="w-full max-w-md rounded-2xl p-4 shadow-2xl"
          style={{ background: "rgba(8,9,18,0.97)", border: "1px solid rgba(255,255,255,0.1)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Playback Settings</h3>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-white/60 hover:bg-white/10" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <Section title="Streaming">
            <label className="flex items-center justify-between gap-3 py-2 text-xs text-white/80">
              <span>Data Saver (cap 480p)</span>
              <input type="checkbox" checked={dataSaver} onChange={(e) => onDataSaverChange(e.target.checked)} />
            </label>
            <label className="flex flex-col gap-1 py-2 text-xs text-white/80">
              <span>Preferred Quality</span>
              <select
                className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-white"
                value={selectedQuality}
                onChange={(e) => onQualityChange(Number(e.target.value))}
              >
                {qualityOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </Section>

          <Section title="Display">
            <div className="flex gap-2 py-2">
              {(["cover", "contain"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onAspectRatioChange(mode)}
                  className="flex-1 rounded-lg py-2 text-[11px] font-semibold capitalize"
                  style={{
                    background: aspectRatio === mode ? "rgba(245,166,35,0.2)" : "rgba(255,255,255,0.06)",
                    border: aspectRatio === mode ? "1px solid rgba(245,166,35,0.45)" : "1px solid rgba(255,255,255,0.08)",
                    color: aspectRatio === mode ? "#F5A623" : "rgba(255,255,255,0.7)",
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Developer">
            <label className="flex items-center justify-between gap-3 py-2 text-xs text-white/80">
              <span>Stream Health overlay</span>
              <input type="checkbox" checked={showStreamHealth} onChange={(e) => onToggleStreamHealth(e.target.checked)} />
            </label>
            {showStreamHealth && (
              <div className="rounded-lg bg-black/40 p-2 font-mono text-[10px] text-emerald-300/90">
                <div>Bitrate: {streamHealth.bitrate}</div>
                <div>Level: {streamHealth.level}</div>
                <div>Mirror: {streamHealth.urlIndex + 1}/{streamHealth.totalUrls}</div>
              </div>
            )}
          </Section>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 border-b border-white/5 pb-2 last:border-0">
      <p className="mb-1 text-[9px] font-black uppercase tracking-[0.16em] text-amber-500/60">{title}</p>
      {children}
    </div>
  );
}
