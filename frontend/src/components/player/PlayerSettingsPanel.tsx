"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Moon, PictureInPicture2, X } from "lucide-react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import type { VideoScaleMode } from "@/components/PremiumPlayer";

const SCALE_OPTIONS: { id: VideoScaleMode; label: string }[] = [
  { id: "contain", label: "Contain" },
  { id: "cover", label: "Cover" },
  { id: "stretch", label: "Stretch" },
  { id: "original", label: "Original Ratio" },
  { id: "zoom1", label: "Zoom 1x" },
  { id: "zoom1.5", label: "Zoom 1.5x" },
  { id: "zoom2", label: "Zoom 2x" },
];

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
  scaleMode: VideoScaleMode;
  onScaleModeChange: (v: VideoScaleMode) => void;
  onTogglePictureInPicture?: () => void;
  pipEnabled?: boolean;
  sleepMinutes: number | null;
  sleepRemaining: number;
  onStartSleepTimer: (minutes: number) => void;
  onCancelSleepTimer: () => void;
};

const SLEEP_OPTIONS = [15, 30, 60, 90];

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
  scaleMode,
  onScaleModeChange,
  onTogglePictureInPicture,
  pipEnabled = false,
  sleepMinutes,
  sleepRemaining,
  onStartSleepTimer,
  onCancelSleepTimer,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    streaming: true,
    display: true,
    sleep: false,
    developer: false,
  });

  if (!open) return null;

  const toggle = (key: string) => setExpanded((s) => ({ ...s, [key]: !s[key] }));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] flex items-end justify-center overflow-hidden sm:items-center sm:p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          className="flex max-h-[min(92dvh,36rem)] w-full max-w-md flex-col overflow-hidden sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <GlassPanel variant="premium" padding="md" className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-2xl">
            <div className="mb-3 flex shrink-0 items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white">Playback Settings</h3>
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-0.5">
              <AccordionSection title="Streaming" open={expanded.streaming} onToggle={() => toggle("streaming")}>
                <label className="flex items-center justify-between gap-3 py-2 text-xs text-white/80">
                  <span>Data Saver (cap 480p)</span>
                  <input type="checkbox" checked={dataSaver} onChange={(e) => onDataSaverChange(e.target.checked)} />
                </label>
                <label className="flex flex-col gap-1 py-2 text-xs text-white/80">
                  <span>Preferred Quality</span>
                  <select
                    className="w-full max-w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-white"
                    value={selectedQuality}
                    onChange={(e) => onQualityChange(Number(e.target.value))}
                  >
                    {qualityOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </AccordionSection>

              <AccordionSection title="Display & Scaling" open={expanded.display} onToggle={() => toggle("display")}>
                <div className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-3">
                  {SCALE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onScaleModeChange(opt.id)}
                      className="rounded-lg py-2 text-[10px] font-semibold"
                      style={{
                        background: scaleMode === opt.id ? "rgba(245,166,35,0.2)" : "rgba(255,255,255,0.06)",
                        border: scaleMode === opt.id ? "1px solid rgba(245,166,35,0.45)" : "1px solid rgba(255,255,255,0.08)",
                        color: scaleMode === opt.id ? "#F5A623" : "rgba(255,255,255,0.7)",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {pipEnabled && onTogglePictureInPicture ? (
                  <button
                    type="button"
                    onClick={onTogglePictureInPicture}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5"
                  >
                    <PictureInPicture2 size={14} />
                    Picture-in-Picture
                  </button>
                ) : null}
              </AccordionSection>

              <AccordionSection title="Sleep Timer" open={expanded.sleep} onToggle={() => toggle("sleep")}>
                <div className="flex flex-wrap gap-2 py-2">
                  {SLEEP_OPTIONS.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => (sleepMinutes === mins ? onCancelSleepTimer() : onStartSleepTimer(mins))}
                      className="rounded-lg px-3 py-1.5 text-[11px] font-semibold"
                      style={{
                        background: sleepMinutes === mins ? "rgba(245,166,35,0.2)" : "rgba(255,255,255,0.06)",
                        border: sleepMinutes === mins ? "1px solid rgba(245,166,35,0.45)" : "1px solid rgba(255,255,255,0.08)",
                        color: sleepMinutes === mins ? "#F5A623" : "rgba(255,255,255,0.7)",
                      }}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
                {sleepMinutes ? (
                  <p className="flex items-center gap-1.5 text-[10px] text-amber-400/90">
                    <Moon size={12} />
                    Stops in {Math.floor(sleepRemaining / 60)}:{String(sleepRemaining % 60).padStart(2, "0")}
                  </p>
                ) : null}
              </AccordionSection>

              <AccordionSection title="Developer" open={expanded.developer} onToggle={() => toggle("developer")}>
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
              </AccordionSection>
            </div>
          </GlassPanel>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function AccordionSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 border-b border-white/5 pb-2 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-1 text-left"
      >
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-500/60">{title}</span>
        <ChevronDown size={14} className={`text-white/50 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div>{children}</div> : null}
    </div>
  );
}
