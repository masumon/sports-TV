"use client";

import Hls from "hls.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  Tv,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { buildApiUrl } from "@/lib/apiClient";
import { shouldPreferServerRelay } from "@/lib/streamRelay";
import { useVpnStore } from "@/store/vpnStore";

/* ─────────────────────────────────────────────────────────── Types ── */
type QualityOption = { label: string; value: number };

export type PremiumPlayerProps = {
  streamUrl: string;
  alternateUrls?: string[];
  title: string;
  /** For relay/VPN heuristics (not used as playback URL; primary channel metadata). */
  relayMeta?: { name: string; category: string; stream_url: string } | null;
  isTheaterMode: boolean;
  onToggleTheaterMode: () => void;
  overlay?: React.ReactNode;
};

/* ────────────────────────────────────── External player definitions ── */
const EXTERNAL_PLAYERS = [
  {
    id: "vlc",
    name: "VLC",
    emoji: "🟠",
    desc: "All platforms",
    scheme: (url: string) => `vlc://${url}`,
    fallback: "https://www.videolan.org/vlc/",
  },
  {
    id: "mx",
    name: "MX Player",
    emoji: "▶️",
    desc: "Android",
    scheme: (url: string) =>
      `intent:${url}#Intent;package=com.mxtech.videoplayer.ad;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.mxtech.videoplayer.ad;end`,
    fallback: "https://play.google.com/store/apps/details?id=com.mxtech.videoplayer.ad",
  },
  {
    id: "pot",
    name: "PotPlayer",
    emoji: "🟢",
    desc: "Windows",
    scheme: (url: string) => `potplayer://${url}`,
    fallback: "https://potplayer.daum.net/",
  },
  {
    id: "iina",
    name: "IINA",
    emoji: "⬛",
    desc: "macOS",
    scheme: (url: string) => `iina://open?url=${encodeURIComponent(url)}`,
    fallback: "https://iina.io/",
  },
  {
    id: "mpv",
    name: "mpv",
    emoji: "🟣",
    desc: "Win/Mac/Linux",
    scheme: (url: string) => `mpv://${url}`,
    fallback: "https://mpv.io/installation/",
  },
  {
    id: "infuse",
    name: "Infuse",
    emoji: "🔵",
    desc: "iOS / tvOS",
    scheme: (url: string) => `infuse://x-callback-url/play?url=${encodeURIComponent(url)}`,
    fallback: "https://apps.apple.com/app/infuse-7/id1136220934",
  },
] as const;

function useMatchMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState(defaultValue);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return matches;
}

/* ─────────────────────────────────────── App-launch detection helper ── */
/** Opens a custom `scheme:` URL to hand the stream to an external app. Android `intent:` passes through as-is. On desktop, if the app does not steal focus (window blur) within 1.5s, the install or store page opens. */
function tryLaunchPlayer(schemeUrl: string, fallbackUrl: string): void {
  if (schemeUrl.startsWith("intent:")) {
    window.location.href = schemeUrl;
    return;
  }
  let didBlur = false;
  const onBlur = () => { didBlur = true; };
  window.addEventListener("blur", onBlur, { once: true });
  window.location.href = schemeUrl;
  setTimeout(() => {
    window.removeEventListener("blur", onBlur);
    if (!didBlur) {
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
    }
  }, 1500);
}

/* ────────────────────────────────────────────────────────── Helpers ── */
const HIDE_CONTROLS_AFTER_MS = 3500;

type NetConn = { saveData?: boolean; effectiveType?: string };

function isConstrainedNetwork(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as Navigator & { connection?: NetConn }).connection;
  if (!c) return false;
  if (c.saveData) return true;
  const t = c.effectiveType;
  return t === "slow-2g" || t === "2g";
}

/** Backend proxy — same base as `apiRequest` (use query on path, not inside path segment). */
function buildProxyUrl(streamUrl: string): string {
  return `${buildApiUrl("/proxy/stream")}?url=${encodeURIComponent(streamUrl)}`;
}

function buildOrderedStreamUrls(preferRelay: boolean, directUrls: string[]): string[] {
  const proxyUrls = directUrls.map(buildProxyUrl);
  return preferRelay ? [...proxyUrls, ...directUrls] : [...directUrls, ...proxyUrls];
}

function formatQualityFromHeight(height: number): string {
  if (height >= 2160) return "4K";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  return `${height}p`;
}

function ExternalPlayerPicker({
  streamUrl,
  onClose,
  idPrefix,
}: {
  streamUrl: string;
  onClose: () => void;
  idPrefix: string;
}) {
  return (
    <div
      className="flex min-h-0 flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-start justify-between gap-2 sm:mb-3">
        <p
          id={`${idPrefix}-ext-title`}
          className="pr-1 text-[9px] font-bold uppercase leading-snug tracking-[0.1em] sm:tracking-[0.12em]"
          style={{ color: "var(--text-muted)" }}
        >
          Open in external app — tap a player (or install if prompted)
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 transition hover:bg-white/10"
          style={{ color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.1)" }}
          aria-label="Close external players"
        >
          <X size={18} />
        </button>
      </div>
      <div className="grid max-h-[min(44dvh,18rem)] grid-cols-2 gap-2 overflow-y-auto overscroll-contain pr-0.5 sm:max-h-none sm:grid-cols-3 md:grid-cols-6">
        {EXTERNAL_PLAYERS.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => {
              tryLaunchPlayer(player.scheme(streamUrl), player.fallback);
              onClose();
            }}
            className="flex min-h-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-2 text-center transition hover:bg-white/10"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            title={`${player.name} — ${player.desc}`}
          >
            <span className="text-lg leading-none sm:text-2xl">{player.emoji}</span>
            <span className="w-full truncate text-[10px] font-bold leading-tight text-white sm:text-[11px]">{player.name}</span>
            <span className="line-clamp-2 text-center text-[8px] leading-tight sm:text-[9px]" style={{ color: "var(--text-muted)" }}>{player.desc}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition hover:bg-white/10 sm:px-3 sm:text-[11px]"
          style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(streamUrl);
              toast.success("Stream URL copied");
            } catch {
              toast.error("Could not copy");
            }
          }}
        >
          <Copy size={12} className="shrink-0" />
          <span>Copy URL</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition hover:bg-white/10 sm:px-3 sm:text-[11px]"
          style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
          onClick={() => window.open(streamUrl, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink size={12} className="shrink-0" />
          <span>Open in tab</span>
        </button>
      </div>
      <p className="mt-2.5 text-[8px] leading-relaxed tracking-wide sm:text-[9px]" style={{ color: "rgba(123,128,154,0.55)" }}>
        Keys: Space · M · F · T · ↑↓
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ Component ═══ */
export default function PremiumPlayer({
  streamUrl,
  alternateUrls,
  title,
  relayMeta,
  isTheaterMode,
  onToggleTheaterMode,
  overlay,
}: PremiumPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([{ label: "Auto", value: -1 }]);
  const [selectedQuality, setSelectedQuality] = useState(-1);
  const [bufferedPct, setBufferedPct] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [showExternalPanel, setShowExternalPanel] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const isMobileSheet = useMatchMediaQuery("(max-width: 639px)");
  const externalPanelTitleId = useId();
  // Failover: index into ordered direct + proxy list
  const [urlIdx, setUrlIdx] = useState(0);

  const vpnMode = useVpnStore((s) => s.mode);
  const directUrls = useMemo(() => [streamUrl, ...(alternateUrls ?? [])], [streamUrl, alternateUrls]);
  const preferRelay = useMemo(
    () => shouldPreferServerRelay(vpnMode, relayMeta ?? { name: title, category: "", stream_url: streamUrl }),
    [vpnMode, relayMeta, title, streamUrl]
  );
  const allUrlsList = useMemo(
    () => buildOrderedStreamUrls(preferRelay, directUrls),
    [preferRelay, directUrls]
  );
  const isCurrentRelay = (allUrlsList[urlIdx] ?? "").includes("/proxy/stream");

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
  }, []);

  const scheduleHideControls = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => setShowControls(false), HIDE_CONTROLS_AFTER_MS);
  }, [clearHideTimer]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (isPlaying) scheduleHideControls();
  }, [isPlaying, scheduleHideControls]);

  useEffect(() => {
    setUrlIdx(0);
    setIsSwitching(false);
  }, [streamUrl, preferRelay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const cleanup = () => { hlsRef.current?.destroy(); hlsRef.current = null; };
    cleanup();
    setQualityOptions([{ label: "Auto", value: -1 }]);
    setSelectedQuality(-1);
    setBufferedPct(0);
    setIsLoading(true);
    setHasError(false);

    // Order: VPN "on" = relay (server) first; "smart" / "off" = direct first unless
    // channelSuggestsServerRelay, then relay first. Same paths as allUrlsList.
    const allUrls = buildOrderedStreamUrls(preferRelay, directUrls);
    const effectiveUrl = allUrls[urlIdx] ?? streamUrl;

    const lightNet = isConstrainedNetwork();
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: !lightNet,
        maxBufferLength: lightNet ? 12 : 30,
        maxMaxBufferLength: lightNet ? 25 : 60,
        maxBufferSize: lightNet ? 25 * 1000 * 1000 : 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        liveSyncDurationCount: lightNet ? 2 : 3,
        liveMaxLatencyDurationCount: lightNet ? 6 : 10,
        liveDurationInfinity: true,
        abrEwmaDefaultEstimate: lightNet ? 400_000 : 1_000_000,
        abrBandWidthFactor: lightNet ? 0.9 : 0.95,
        abrBandWidthUpFactor: lightNet ? 0.55 : 0.7,
        manifestLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: lightNet ? 800 : 500,
        levelLoadingMaxRetry: 2,
        levelLoadingRetryDelay: lightNet ? 800 : 500,
        fragLoadingMaxRetry: 3,
        fragLoadingRetryDelay: lightNet ? 800 : 500,
        startLevel: -1,
        capLevelToPlayerSize: true,
      });
      hlsRef.current = hls;
      hls.loadSource(effectiveUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          const nextIdx = urlIdx + 1;
          if (nextIdx < allUrls.length) {
            setIsSwitching(true);
            setIsLoading(true);
            const nextU = allUrls[nextIdx] ?? "";
            if (nextU.includes("/proxy/stream")) {
              toast.info("Trying server relay (VPN)…");
            } else {
              toast.info("Trying another source…");
            }
            setUrlIdx(nextIdx);
          } else {
            setIsSwitching(false);
            setHasError(true);
            setIsLoading(false);
            toast.error("All streams unavailable — try an external player or another channel");
          }
        }
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (lightNet && hls.levels.length) {
          const underSd = hls.levels
            .map((level, idx) => (level.height && level.height <= 480 ? idx : -1))
            .filter((idx) => idx >= 0);
          if (underSd.length > 0) hls.autoLevelCapping = Math.max(...underSd);
        }
        setIsLoading(false);
        setHasError(false);
        setIsSwitching(false);
        void video.play().catch(() => {
          video.muted = true;
          void video.play().catch(() => {});
        });
        const levelMap = new Map<number, QualityOption>();
        hls.levels.forEach((level, idx) => {
          if (!level.height) return;
          if (!levelMap.has(level.height)) {
            levelMap.set(level.height, { label: formatQualityFromHeight(level.height), value: idx });
          }
        });
        const parsed = [...levelMap.entries()].sort((a, b) => b[0] - a[0]).map(([, o]) => o);
        if (parsed.length) setQualityOptions([{ label: "Auto", value: -1 }, ...parsed]);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => setSelectedQuality(data.level));
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = effectiveUrl;
      setIsLoading(false);
      setIsSwitching(false);
    }

    return cleanup;
  }, [streamUrl, retryKey, urlIdx, alternateUrls, preferRelay, directUrls]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => { setIsPlaying(true); scheduleHideControls(); };
    const onPause = () => { setIsPlaying(false); setShowControls(true); clearHideTimer(); };
    const onVolumeChange = () => { setIsMuted(video.muted); setVolumeState(video.volume); };
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => { setIsLoading(false); setHasError(false); };
    const onCanPlay = () => setIsLoading(false);
    const onError = () => { setHasError(true); setIsLoading(false); };
    const onProgress = () => {
      if (!video.buffered.length) return;
      const end = video.buffered.end(video.buffered.length - 1);
      const dur = video.duration;
      if (dur > 0 && Number.isFinite(dur)) setBufferedPct(Math.min(100, (end / dur) * 100));
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", onError);
    video.addEventListener("progress", onProgress);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
      video.removeEventListener("progress", onProgress);
    };
  }, [clearHideTimer, scheduleHideControls]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => () => { clearHideTimer(); hlsRef.current?.destroy(); }, [clearHideTimer]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (showExternalPanel && isMobileSheet) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [showExternalPanel, isMobileSheet]);

  const togglePlayPause = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { await video.play(); } else { video.pause(); }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const setVolumeLevel = useCallback((v: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, v));
    video.volume = clamped;
    video.muted = clamped === 0;
    setVolumeState(clamped);
    setIsMuted(clamped === 0);
  }, []);

  const changeQuality = useCallback((level: number) => {
    setSelectedQuality(level);
    if (hlsRef.current) hlsRef.current.currentLevel = level;
  }, []);

  const togglePictureInPicture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    if (document.pictureInPictureElement) { await document.exitPictureInPicture(); }
    else { await video.requestPictureInPicture(); }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) { await document.exitFullscreen(); }
    else { await el.requestFullscreen(); }
  }, []);

  const retryStream = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    setUrlIdx(0);           // restart from primary stream
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") return;
      switch (e.code) {
        case "Space": e.preventDefault(); void togglePlayPause(); break;
        case "KeyM": toggleMute(); break;
        case "KeyF": void toggleFullscreen(); break;
        case "KeyT": onToggleTheaterMode(); break;
        case "ArrowUp": e.preventDefault(); setVolumeLevel(Math.min(1, volume + 0.1)); break;
        case "ArrowDown": e.preventDefault(); setVolumeLevel(Math.max(0, volume - 0.1)); break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [togglePlayPause, toggleMute, toggleFullscreen, onToggleTheaterMode, setVolumeLevel, volume]);

  const currentQualityLabel = useMemo(() => {
    if (selectedQuality === -1) return "AUTO";
    return qualityOptions.find((o) => o.value === selectedQuality)?.label ?? "AUTO";
  }, [qualityOptions, selectedQuality]);

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const handlePlayerPointerLeave = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return;
    if (isPlaying) setShowControls(false);
  }, [isPlaying]);

  return (
    <motion.div
      ref={containerRef}
      className={`player-shell relative isolate overflow-hidden ${isTheaterMode ? "h-[75vh] min-h-[200px]" : "aspect-video"}`}
      onMouseMove={showControlsTemporarily}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={handlePlayerPointerLeave}
      onTouchStart={() => {
        setShowControls(true);
        if (isPlaying) scheduleHideControls();
      }}
      initial={{ opacity: 0, scale: 0.995 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        autoPlay
        playsInline
        controls={false}
        preload="metadata"
      />

      {/* Click-to-play */}
      <div className="absolute inset-0 z-10 cursor-pointer" onClick={() => void togglePlayPause()} />

      {/* Buffer bar — gold */}
      <div className="absolute bottom-0 left-0 right-0 z-20 h-[3px] bg-white/10">
        <motion.div
          className="h-full"
          style={{ background: "linear-gradient(90deg, var(--primary-accent), var(--gold))" }}
          animate={{ width: `${bufferedPct}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Loading / Switching spinner */}
      <AnimatePresence>
        {(isLoading || isSwitching) && !hasError && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3"
            style={{ background: "rgba(7,8,15,0.6)", backdropFilter: "blur(4px)" }}
          >
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full opacity-25" style={{ background: "var(--primary-accent)" }} />
              <Loader2 className="h-10 w-10 animate-spin" style={{ color: "var(--primary-accent)" }} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
              {isSwitching
                ? (isCurrentRelay ? "Server relay (VPN)…" : "Switching stream…")
                : (isCurrentRelay ? "Server relay (VPN)…" : "Loading stream…")}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error overlay */}
      <AnimatePresence>
        {hasError && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 p-6"
            style={{ background: "rgba(7,8,15,0.88)" }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(229,57,53,0.15)", border: "1px solid rgba(229,57,53,0.4)" }}>
              <AlertTriangle className="h-7 w-7 text-red-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white">Stream unavailable</p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>This stream may be offline. Try another channel or an external player.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={retryStream}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition"
                style={{ background: "rgba(245,166,35,0.18)", border: "1px solid rgba(245,166,35,0.4)" }}>
                <RefreshCw size={13} /> Retry
              </button>
              <button type="button" onClick={() => window.open(streamUrl, "_blank", "noopener,noreferrer")}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-muted)" }}>
                <ExternalLink size={13} /> Open in tab
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LIVE + relay (VPN) — top inset locked (safe area); avoids “jumping” when bottom panel opens on mobile */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-40 flex flex-wrap items-center gap-2 px-3 sm:left-3 sm:right-auto"
        style={{
          top: "max(0.75rem, env(safe-area-inset-top, 0px))",
        }}
      >
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white sm:text-[11px]"
          style={{
            background: "rgba(229,57,53,0.9)",
            border: "1px solid rgba(255,82,82,0.45)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
          }}
        >
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-white" />
          LIVE
        </span>
        {isCurrentRelay && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest sm:text-[10px]"
            style={{
              background: "rgba(16,185,129,0.22)",
              border: "1px solid rgba(16,185,129,0.45)",
              color: "#6ee7b7",
            }}
          >
            VPN
          </span>
        )}
      </div>

      {/* Custom overlay */}
      {overlay}

      {/* Controls panel */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            key="controls"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-0 bottom-0 z-40"
          >
            <div className="glass-panel mx-2 mb-2 overflow-hidden rounded-2xl sm:mx-3 sm:mb-3">
              {/* Now playing — subtle top gradient */}
              <div
                className="border-b border-white/[0.06] px-3.5 pb-2.5 pt-3.5 sm:px-4"
                style={{ background: "linear-gradient(180deg, rgba(245,166,35,0.08) 0%, transparent 100%)" }}
              >
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] sm:text-[9px] sm:tracking-[0.22em]" style={{ color: "var(--primary-accent)" }}>
                      Now playing
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold leading-tight text-white">{title}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <span
                      className="rounded-md px-2 py-0.5 text-[9px] font-bold tabular-nums sm:text-[10px]"
                      style={{ background: "rgba(245,166,35,0.12)", color: "var(--primary-accent)", border: "1px solid rgba(245,166,35,0.28)" }}
                    >
                      {currentQualityLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowExternalPanel((v) => !v)}
                      className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wide sm:px-2.5 sm:text-[10px]"
                      style={{
                        background: showExternalPanel ? "rgba(245,166,35,0.15)" : "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: showExternalPanel ? "var(--primary-accent)" : "var(--text-muted)",
                      }}
                    >
                      <Tv size={12} className="shrink-0" />
                      <span className="hidden min-[400px]:inline">Players</span>
                      {showExternalPanel ? <ChevronUp size={11} className="shrink-0" /> : <ChevronDown size={11} className="shrink-0" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Main controls */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none px-3 pb-3 pt-1 sm:gap-3 sm:px-4 sm:pb-3.5 sm:pt-0">
                <button className="control-btn shrink-0" type="button" onClick={() => void togglePlayPause()}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  style={isPlaying ? { background: "rgba(245,166,35,0.2)", borderColor: "rgba(245,166,35,0.5)", color: "var(--primary-accent)" } : {}}>
                  {isPlaying ? <Pause size={17} /> : <Play size={17} />}
                </button>
                <button className="control-btn shrink-0" type="button" onClick={toggleMute} aria-label="Toggle mute">
                  <VolumeIcon size={17} />
                </button>
                <input type="range" min={0} max={1} step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolumeLevel(Number(e.target.value))}
                  className="volume-slider w-16 sm:w-24 shrink-0" aria-label="Volume" />
                <select className="quality-select shrink-0" value={selectedQuality}
                  onChange={(e) => changeQuality(Number(e.target.value))} aria-label="Quality">
                  {qualityOptions.map((opt) => (
                    <option key={`${opt.label}-${opt.value}`} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button className="control-btn shrink-0" type="button" onClick={() => void togglePictureInPicture()} aria-label="PiP" title="Picture-in-Picture">
                  <PictureInPicture2 size={17} />
                </button>
                <button className="control-btn shrink-0" type="button" onClick={onToggleTheaterMode} aria-label="Theater mode" title="Theater (T)"
                  style={isTheaterMode ? { background: "rgba(245,166,35,0.2)", borderColor: "rgba(245,166,35,0.5)", color: "var(--primary-accent)" } : {}}>
                  <Tv size={17} />
                </button>
                <button className="control-btn shrink-0" type="button" onClick={() => void toggleFullscreen()} aria-label="Fullscreen" title="Fullscreen (F)">
                  {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
                </button>
              </div>

              {/* External players: bottom sheet on mobile (no in-player height jump). Inline on sm+ */}
              {!isMobileSheet && (
                <div
                  className="grid border-t border-white/[0.07] transition-[grid-template-rows] duration-200 ease-out"
                  style={{ gridTemplateRows: showExternalPanel ? "1fr" : "0fr" }}
                >
                  <div className="min-h-0 overflow-hidden">
                    {showExternalPanel && (
                      <div className="px-2 pb-3 pt-2.5 sm:px-4 sm:pb-4 sm:pt-3">
                        <ExternalPlayerPicker
                          idPrefix={externalPanelTitleId}
                          streamUrl={streamUrl}
                          onClose={() => setShowExternalPanel(false)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {typeof document !== "undefined" && isMobileSheet && showExternalPanel
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${externalPanelTitleId}-ext-title`}
              className="fixed inset-0 z-[200] flex flex-col justify-end sm:hidden"
            >
              <button
                type="button"
                className="absolute inset-0 z-0 border-0 bg-black/70 backdrop-blur-sm"
                aria-label="Close player picker"
                onClick={() => setShowExternalPanel(false)}
              />
              <div
                className="relative z-10 max-h-[min(70dvh,32rem)] overflow-hidden rounded-t-2xl border border-white/10 bg-[#080910] shadow-2xl"
                style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
              >
                <div className="flex justify-center pt-2" aria-hidden>
                  <div className="h-1 w-10 rounded-full bg-white/20" />
                </div>
                <div className="max-h-[min(65dvh,30rem)] overflow-y-auto overflow-x-hidden px-3 pt-1 pb-1">
                  <ExternalPlayerPicker
                    idPrefix={externalPanelTitleId}
                    streamUrl={streamUrl}
                    onClose={() => setShowExternalPanel(false)}
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </motion.div>
  );
}
