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
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

/* ─────────────────────────────────────────────────────────── Types ── */
type QualityOption = { label: string; value: number };

export type PremiumPlayerProps = {
  streamUrl: string;
  alternateUrls?: string[];
  title: string;
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

/* ─────────────────────────────────────── App-launch detection helper ── */
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

/** Backend proxy endpoint — bypasses CORS and some geo-blocks for the player. */
const PROXY_STREAM_PATH = "/api/v1/proxy/stream";

function buildProxyUrl(streamUrl: string): string {
  return `${PROXY_STREAM_PATH}?url=${encodeURIComponent(streamUrl)}`;
}

function formatQualityFromHeight(height: number): string {
  if (height >= 2160) return "4K";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  return `${height}p`;
}

/* ═══════════════════════════════════════════════════════ Component ═══ */
export default function PremiumPlayer({
  streamUrl,
  alternateUrls,
  title,
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
  // Failover: index into [streamUrl, ...alternateUrls]
  const [urlIdx, setUrlIdx] = useState(0);

  // Derive whether we are currently in proxy-fallback phase.
  // directUrlCount = primary + any provided alternates.
  const directUrlCount = 1 + (alternateUrls?.length ?? 0);
  const isInProxyPhase = urlIdx >= directUrlCount;

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
    // Reset failover index whenever the primary stream URL changes (channel switch).
    setUrlIdx(0);
    setIsSwitching(false);
  }, [streamUrl]);

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

    // Build URL list: direct streams first, then proxy fallbacks.
    // Proxy fallback routes each URL through the backend which can bypass
    // CORS restrictions and some geo-blocks from the server's region.
    const directUrls = [streamUrl, ...(alternateUrls ?? [])];
    const proxyUrls = directUrls.map(buildProxyUrl);
    const allUrls = [...directUrls, ...proxyUrls];
    const effectiveUrl = allUrls[urlIdx] ?? streamUrl;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        // Buffer tuning for low-latency live streaming
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,  // 60 MB
        maxBufferHole: 0.5,
        // Live stream sync settings
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        liveDurationInfinity: true,
        // ABR (adaptive bitrate) — prefer higher quality but allow fast switch
        abrEwmaDefaultEstimate: 1_000_000,  // start with 1 Mbps estimate
        abrBandWidthFactor: 0.95,
        abrBandWidthUpFactor: 0.7,
        // Faster manifest fetching
        manifestLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: 500,
        levelLoadingMaxRetry: 2,
        levelLoadingRetryDelay: 500,
        fragLoadingMaxRetry: 3,
        fragLoadingRetryDelay: 500,
        // Start level: auto (let ABR decide)
        startLevel: -1,
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
            // Notify user only on first proxy attempt or named backup switches
            if (nextIdx === directUrls.length) {
              toast.info("Trying proxy stream…");
            } else if (nextIdx < directUrls.length) {
              toast.info(`Switching to backup stream ${nextIdx} of ${directUrls.length - 1}…`);
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
  }, [streamUrl, retryKey, urlIdx, alternateUrls]);

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

  return (
    <motion.div
      ref={containerRef}
      className={`player-shell relative overflow-hidden ${isTheaterMode ? "h-[75vh]" : "aspect-video"}`}
      onMouseMove={showControlsTemporarily}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
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
                ? isInProxyPhase
                  ? "Trying via proxy…"
                  : "Switching stream…"
                : "Loading stream…"}
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

      {/* LIVE badge */}
      <div className="pointer-events-none absolute left-3 top-3 z-40">
        <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white"
          style={{ background: "rgba(229,57,53,0.88)", border: "1px solid rgba(255,82,82,0.5)", boxShadow: "0 0 16px rgba(229,57,53,0.45)" }}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          LIVE
        </span>
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
            <div className="glass-panel mx-3 mb-3 overflow-hidden rounded-2xl">
              {/* Now playing strip */}
              <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--primary-accent)" }}>
                    ● NOW PLAYING
                  </p>
                  <p className="mt-0.5 truncate text-sm font-bold text-white">{title}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-md px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: "rgba(245,166,35,0.15)", color: "var(--primary-accent)", border: "1px solid rgba(245,166,35,0.3)" }}>
                    {currentQualityLabel}
                  </span>
                  <button type="button"
                    onClick={() => setShowExternalPanel((v) => !v)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition"
                    style={{
                      background: showExternalPanel ? "rgba(245,166,35,0.15)" : "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: showExternalPanel ? "var(--primary-accent)" : "var(--text-muted)",
                    }}>
                    <Tv size={12} />
                    Players
                    {showExternalPanel ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  </button>
                </div>
              </div>

              {/* Main controls */}
              <div className="flex flex-wrap items-center gap-2 px-4 pb-3.5">
                <button className="control-btn" type="button" onClick={() => void togglePlayPause()}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  style={isPlaying ? { background: "rgba(245,166,35,0.2)", borderColor: "rgba(245,166,35,0.5)", color: "var(--primary-accent)" } : {}}>
                  {isPlaying ? <Pause size={17} /> : <Play size={17} />}
                </button>
                <button className="control-btn" type="button" onClick={toggleMute} aria-label="Toggle mute">
                  <VolumeIcon size={17} />
                </button>
                <input type="range" min={0} max={1} step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolumeLevel(Number(e.target.value))}
                  className="volume-slider w-16 sm:w-24" aria-label="Volume" />
                <div className="flex-1" />
                <select className="quality-select" value={selectedQuality}
                  onChange={(e) => changeQuality(Number(e.target.value))} aria-label="Quality">
                  {qualityOptions.map((opt) => (
                    <option key={`${opt.label}-${opt.value}`} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button className="control-btn" type="button" onClick={() => void togglePictureInPicture()} aria-label="PiP" title="Picture-in-Picture">
                  <PictureInPicture2 size={17} />
                </button>
                <button className="control-btn" type="button" onClick={onToggleTheaterMode} aria-label="Theater mode" title="Theater (T)"
                  style={isTheaterMode ? { background: "rgba(245,166,35,0.2)", borderColor: "rgba(245,166,35,0.5)", color: "var(--primary-accent)" } : {}}>
                  <Tv size={17} />
                </button>
                <button className="control-btn" type="button" onClick={() => void toggleFullscreen()} aria-label="Fullscreen" title="Fullscreen (F)">
                  {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
                </button>
              </div>

              {/* External Players panel */}
              <AnimatePresence>
                {showExternalPanel && (
                  <motion.div
                    key="ext"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
                        Open stream in external player — click to launch (or install if missing)
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {EXTERNAL_PLAYERS.map((player) => (
                          <button key={player.id} type="button"
                            onClick={() => tryLaunchPlayer(player.scheme(streamUrl), player.fallback)}
                            className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-center transition hover:bg-white/10"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                            title={`${player.name} — ${player.desc}`}>
                            <span className="text-xl leading-none">{player.emoji}</span>
                            <span className="text-[11px] font-bold leading-none text-white">{player.name}</span>
                            <span className="text-[9px] leading-tight" style={{ color: "var(--text-muted)" }}>{player.desc}</span>
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button"
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition hover:bg-white/10"
                          style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
                          onClick={async () => {
                            try { await navigator.clipboard.writeText(streamUrl); toast.success("Stream URL copied"); }
                            catch { toast.error("Could not copy"); }
                          }}>
                          <Copy size={12} /> Copy stream URL
                        </button>
                        <button type="button"
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition hover:bg-white/10"
                          style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
                          onClick={() => window.open(streamUrl, "_blank", "noopener,noreferrer")}>
                          <ExternalLink size={12} /> Open in new tab
                        </button>
                      </div>
                      <p className="mt-2.5 text-[9px] tracking-wide" style={{ color: "rgba(123,128,154,0.55)" }}>
                        Keys: Space Play/Pause · M Mute · F Fullscreen · T Theater · ↑↓ Volume
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
