"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cast,
  ChevronRight,
  ExternalLink,
  Flag,
  Gauge,
  PictureInPicture2,
  RefreshCw,
  Subtitles,
  Sun,
  Volume2,
  X,
  Zap,
} from "lucide-react";

export type AudioTrackOption = { id: string; label: string };
export type SubtitleTrackOption = { id: string; label: string };

const PLAYBACK_SPEEDS = [0.5, 1, 1.25, 1.5, 2];
const STANDARD_QUALITIES = [
  { label: "Auto", value: -1 },
  { label: "1080p", value: 1080 },
  { label: "720p", value: 720 },
  { label: "480p", value: 480 },
];

type Props = {
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
  selectedQuality: number;
  qualityOptions: { label: string; value: number }[];
  onQualityChange: (v: number) => void;
  audioTracks: AudioTrackOption[];
  selectedAudioTrack: string;
  onAudioTrackChange: (id: string) => void;
  subtitleTracks: SubtitleTrackOption[];
  selectedSubtitle: string;
  onSubtitleChange: (id: string) => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
  castAvailable: boolean;
  pipEnabled: boolean;
  pipActive: boolean;
  onTogglePictureInPicture?: () => void;
  onOpenExternalPlayer?: () => void;
  onReloadStream?: () => void;
  lowLatencyMode: boolean;
  onLowLatencyModeChange: (v: boolean) => void;
  streamInfo: {
    resolution: string;
    codec: string;
    bitrate: string;
    source: string;
  };
  onReportIssue?: () => void;
  brightness?: number;
  onBrightnessChange?: (pct: number) => void;
};

export function PlayerSettingsPanel({
  open,
  onClose,
  isMobile,
  selectedQuality,
  qualityOptions,
  onQualityChange,
  audioTracks,
  selectedAudioTrack,
  onAudioTrackChange,
  subtitleTracks,
  selectedSubtitle,
  onSubtitleChange,
  playbackSpeed,
  onPlaybackSpeedChange,
  castAvailable,
  pipEnabled,
  pipActive,
  onTogglePictureInPicture,
  onOpenExternalPlayer,
  onReloadStream,
  lowLatencyMode,
  onLowLatencyModeChange,
  streamInfo,
  onReportIssue,
  brightness = 100,
  onBrightnessChange,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>("quality");

  const qualityChoices = mergeQualityOptions(qualityOptions);
  const toggle = (key: string) => setExpanded((prev) => (prev === key ? null : key));

  if (!open) return null;

  const panel = (
    <motion.div
      initial={isMobile ? { y: "100%" } : { x: "100%" }}
      animate={isMobile ? { y: 0 } : { x: 0 }}
      exit={isMobile ? { y: "100%" } : { x: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 320 }}
      className={`player-settings-panel flex flex-col overflow-hidden ${
        isMobile
          ? "absolute inset-x-0 bottom-0 z-[130] max-h-[min(78%,22rem)] rounded-t-[20px]"
          : "absolute inset-y-0 right-0 z-[130] w-[min(100%,17.5rem)] max-w-full rounded-l-2xl"
      }`}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Player settings"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3.5">
        <h2 className="text-sm font-bold text-white">Settings</h2>
        <button
          type="button"
          onClick={onClose}
          className="player-control-btn !h-10 !w-10"
          aria-label="Close settings"
        >
          <X size={18} />
        </button>
      </div>

      {isMobile ? (
        <div className="flex justify-center pt-1 pb-0" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pb-6">
        <SettingsSection
          title="Video Quality"
          icon={<Gauge size={14} />}
          open={expanded === "quality"}
          onToggle={() => toggle("quality")}
        >
          <OptionGrid
            options={qualityChoices.map((q) => ({ id: String(q.value), label: q.label }))}
            selected={String(resolveSelectedQualityValue(selectedQuality, qualityChoices))}
            onSelect={(id) => onQualityChange(Number(id))}
          />
        </SettingsSection>

        <SettingsSection
          title="Audio Track"
          icon={<Volume2 size={14} />}
          open={expanded === "audio"}
          onToggle={() => toggle("audio")}
        >
          {audioTracks.length ? (
            <OptionList
              options={audioTracks}
              selected={selectedAudioTrack}
              onSelect={onAudioTrackChange}
            />
          ) : (
            <p className="py-2 text-xs text-white/45">Default audio track</p>
          )}
        </SettingsSection>

        <SettingsSection
          title="Subtitles"
          icon={<Subtitles size={14} />}
          open={expanded === "subtitles"}
          onToggle={() => toggle("subtitles")}
        >
          <OptionList
            options={[{ id: "off", label: "Off" }, ...subtitleTracks]}
            selected={selectedSubtitle}
            onSelect={onSubtitleChange}
          />
        </SettingsSection>

        <SettingsSection
          title="Playback Speed"
          icon={<Gauge size={14} />}
          open={expanded === "speed"}
          onToggle={() => toggle("speed")}
        >
          <OptionGrid
            options={PLAYBACK_SPEEDS.map((s) => ({ id: String(s), label: `${s}x` }))}
            selected={String(playbackSpeed)}
            onSelect={(id) => onPlaybackSpeedChange(Number(id))}
          />
        </SettingsSection>

        {onBrightnessChange ? (
          <SettingsSection title="Brightness" icon={<Sun size={14} />} open={expanded === "brightness"} onToggle={() => toggle("brightness")}>
            <div className="flex items-center gap-3 px-1 py-2">
              <Sun size={14} className="shrink-0 text-white/50" aria-hidden />
              <input
                type="range"
                min={10}
                max={100}
                value={brightness}
                onChange={(e) => onBrightnessChange(Number(e.target.value))}
                className="player-live-timeline flex-1"
                aria-label="Brightness"
              />
              <span className="w-8 text-right text-[10px] font-bold tabular-nums text-white/70">{brightness}%</span>
            </div>
          </SettingsSection>
        ) : null}

        <SettingsSection title="Cast" icon={<Cast size={14} />} open={expanded === "cast"} onToggle={() => toggle("cast")}>
          <p className="py-2 text-xs text-white/45">
            {castAvailable ? "Select a Cast device from your browser menu." : "No Cast devices detected on this browser."}
          </p>
        </SettingsSection>

        <SettingsSection title="Picture in Picture" icon={<PictureInPicture2 size={14} />} open={expanded === "pip"} onToggle={() => toggle("pip")}>
          {pipEnabled && onTogglePictureInPicture ? (
            <ActionRow
              label={pipActive ? "Disable Picture in Picture" : "Enable Picture in Picture"}
              onClick={onTogglePictureInPicture}
            />
          ) : (
            <p className="py-2 text-xs text-white/45">Picture in Picture is not supported.</p>
          )}
        </SettingsSection>

        <SettingsSection title="External Player" icon={<ExternalLink size={14} />} open={expanded === "external"} onToggle={() => toggle("external")}>
          {onOpenExternalPlayer ? (
            <ActionRow label="Open externally" onClick={onOpenExternalPlayer} />
          ) : null}
        </SettingsSection>

        <SettingsSection title="Reload Stream" icon={<RefreshCw size={14} />} open={expanded === "reload"} onToggle={() => toggle("reload")}>
          {onReloadStream ? (
            <ActionRow
              label="Manual refresh"
              onClick={() => {
                onReloadStream();
                onClose();
              }}
            />
          ) : null}
        </SettingsSection>

        <SettingsSection title="Low Latency Mode" icon={<Zap size={14} />} open={expanded === "latency"} onToggle={() => toggle("latency")}>
          <ToggleRow
            label={lowLatencyMode ? "Enabled" : "Disabled"}
            checked={lowLatencyMode}
            onChange={onLowLatencyModeChange}
          />
          <p className="pb-1 text-[10px] leading-relaxed text-white/40">
            Reduces buffer for faster live edge. Stream reloads when toggled.
          </p>
        </SettingsSection>

        <SettingsSection title="Stream Information" icon={<Gauge size={14} />} open={expanded === "info"} onToggle={() => toggle("info")}>
          <InfoGrid
            rows={[
              ["Resolution", streamInfo.resolution],
              ["Codec", streamInfo.codec],
              ["Bitrate", streamInfo.bitrate],
              ["Source", streamInfo.source],
            ]}
          />
        </SettingsSection>

        <SettingsSection title="Report Stream Issue" icon={<Flag size={14} />} open={expanded === "report"} onToggle={() => toggle("report")}>
          <ActionRow label="Report stream issue" onClick={() => onReportIssue?.()} />
        </SettingsSection>
      </div>
    </motion.div>
  );

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[125] border-0 bg-black/50 backdrop-blur-[2px]"
            aria-label="Close settings"
            onClick={onClose}
          />
          {panel}
        </>
      ) : null}
    </AnimatePresence>
  );
}

function mergeQualityOptions(dynamic: { label: string; value: number }[]) {
  const map = new Map<number, string>();
  for (const q of STANDARD_QUALITIES) map.set(q.value, q.label);
  for (const q of dynamic) {
    if (q.value === -1) continue;
    const height = parseHeightFromLabel(q.label);
    if (height) map.set(height, q.label);
  }
  return [
    { label: "Auto", value: -1 },
    ...[...map.entries()]
      .filter(([v]) => v !== -1)
      .sort((a, b) => b[0] - a[0])
      .map(([value, label]) => ({ label, value })),
  ];
}

function parseHeightFromLabel(label: string): number | null {
  const m = label.match(/(\d{3,4})p/i);
  return m ? Number(m[1]) : null;
}

function resolveSelectedQualityValue(
  selected: number,
  choices: { label: string; value: number }[]
): number {
  if (selected === -1) return -1;
  const match = choices.find((c) => c.value === selected);
  if (match) return match.value;
  const h = choices.find((c) => c.label.includes(String(selected)));
  return h?.value ?? selected;
}

function SettingsSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/5 py-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-white/90">
          <span className="text-white/50">{icon}</span>
          {title}
        </span>
        <ChevronRight size={14} className={`text-white/40 transition ${open ? "rotate-90" : ""}`} />
      </button>
      {open ? <div className="pb-3">{children}</div> : null}
    </div>
  );
}

function OptionGrid({
  options,
  selected,
  onSelect,
}: {
  options: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onSelect(opt.id)}
          className={`player-settings-chip ${selected === opt.id ? "player-settings-chip-active" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function OptionList({
  options,
  selected,
  onSelect,
}: {
  options: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onSelect(opt.id)}
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-medium transition ${
            selected === opt.id ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
          }`}
        >
          {opt.label}
          {selected === opt.id ? <span className="text-[10px] text-red-400">Active</span> : null}
        </button>
      ))}
    </div>
  );
}

function ActionRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-white/80 transition hover:bg-white/5"
    >
      {label}
      <ChevronRight size={14} className="text-white/35" />
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 text-xs text-white/80">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-red-500"
      />
    </label>
  );
}

function InfoGrid({ rows }: { rows: [string, string][] }) {
  return (
    <div className="space-y-1.5 rounded-xl bg-white/[0.03] p-3 font-mono text-[10px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 text-white/55">
          <span>{k}</span>
          <span className="truncate text-right text-emerald-300/90">{v}</span>
        </div>
      ))}
    </div>
  );
}
