"use client";

import * as dashjs from "dashjs";
import Hls from "hls.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ChevronLeft,
  Circle,
  ExternalLink,
  Globe,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  Scaling,
  Settings,
  Share2,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ExternalPlayerPicker } from "@/components/player/ExternalPlayerPicker";
import { PlayerSettingsPanel } from "@/components/player/PlayerSettingsPanel";
import { warmBackupStreams } from "@/lib/streamWarmup";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildProxyM3U8RequestUrl,
  buildProxyStreamUrl,
  isDashProxiedStreamUrl,
  parseDynamicM3U8IdFromStreamUrl,
} from "@/lib/streamRelay";

/* ─────────────────────────────────────────────────────────── Types ── */
type QualityOption = { label: string; value: number };

export type VideoScaleMode = "contain" | "cover" | "stretch" | "original" | "zoom1" | "zoom1.5" | "zoom2";

const SCALE_OPTIONS: { id: VideoScaleMode; label: string }[] = [
  { id: "contain", label: "Contain" },
  { id: "cover", label: "Cover" },
  { id: "stretch", label: "Stretch" },
  { id: "original", label: "Original" },
  { id: "zoom1", label: "Zoom 1x" },
  { id: "zoom1.5", label: "Zoom 1.5x" },
  { id: "zoom2", label: "Zoom 2x" },
];

const BAR_QUALITY_OPTIONS: QualityOption[] = [
  { label: "Auto", value: -1 },
  { label: "360p", value: 360 },
  { label: "480p", value: 480 },
  { label: "720p", value: 720 },
  { label: "1080p", value: 1080 },
];

function videoObjectClass(mode: VideoScaleMode, mobileFullscreen: boolean): string {
  if (mobileFullscreen) return "object-contain";
  if (mode === "stretch") return "object-fill";
  if (mode === "original") return "object-none";
  if (mode === "contain" || mode.startsWith("zoom")) return "object-contain";
  return "object-cover";
}

function videoZoomScale(mode: VideoScaleMode): number {
  if (mode === "zoom1.5") return 1.5;
  if (mode === "zoom2") return 2;
  return 1;
}

export type PremiumPlayerProps = {
  streamUrl: string;
  /** When set, ordered direct URLs for playback + failover (overrides streamUrl/alternate ordering). */
  streamUrls?: string[];
  alternateUrls?: string[];
  title: string;
  isTheaterMode: boolean;
  onToggleTheaterMode: () => void;
  overlay?: React.ReactNode;
  /** Backend allowlisted header preset (e.g. tsports). */
  headerProfile?: string | null;
  /** Prefer VPN messaging when playback fails with geo errors. */
  geoHint?: boolean;
  /** Channel logo on the video; when empty, app brand logo is shown (same as TopBar). */
  channelLogoUrl?: string | null;
  /** Called when all stream sources have errored out. */
  onStreamError?: () => void;
};

/** Matches `TopBar` / `Sidebar` — always shown on the player when channel has no logo. */
const DEFAULT_PLAYER_BRAND_LOGO = "/icons/abo-sports-tv-logo.png";
const DATA_SAVER_KEY = "gstv-data-saver";

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

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: "landscape" | "landscape-primary" | "any") => Promise<void>;
};

/** Best-effort landscape lock for mobile playback (works on many Android browsers, often requires fullscreen). */
async function tryLockLandscapePlayback(): Promise<void> {
  if (typeof screen === "undefined") return;
  const o = screen.orientation as ScreenOrientationWithLock | null;
  if (!o?.lock) return;
  try {
    await o.lock("landscape");
  } catch {
    try {
      await o.lock("landscape-primary");
    } catch {
      /* iOS / unsupported / not fullscreen */
    }
  }
}

function tryUnlockPlaybackOrientation(): void {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* */
  }
}

/* ────────────────────────────────────────────────────────── Helpers ── */
const HIDE_CONTROLS_AFTER_MS = 3500;
/** First-play: keep controls visible longer so new users can orient themselves. */
const HIDE_CONTROLS_INITIAL_MS = 8000;

type NetConn = { saveData?: boolean; effectiveType?: string };

function isConstrainedNetwork(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as Navigator & { connection?: NetConn }).connection;
  if (!c) return false;
  if (c.saveData) return true;
  const t = c.effectiveType;
  return t === "slow-2g" || t === "2g";
}

/**
 * Backend proxy URLs for each direct URL. When a channel uses
 * `/proxy/m3u8?stream_id=…`, the same `stream_id` is passed so the server
 * can attach DB-captured headers to segment requests.
 */
/**
 * In-browser playback always uses the API proxy (never loads HLS/keys from the origin
 * — avoids lost Referer/Cookie, CORS, and geo client blocks). Mirror failover is
 * the ordered list; each item is a proxy URL.
 */
function buildOrderedStreamUrls(
  directUrls: string[],
  dynamicM3U8Id: number | null,
  headerProfile: string | null | undefined
): string[] {
  const id = dynamicM3U8Id ?? undefined;
  const hp = headerProfile?.trim() || undefined;
  const opt =
    id == null && !hp ? undefined : { dynamicM3U8Id: id, headerProfile: hp };
  return directUrls.map((u) => buildProxyStreamUrl(u, opt));
}

/** HLS.js would otherwise request `http://…` segment URLs directly → blocked as mixed content on HTTPS. */
function relayHlsXhrUrlIfNeeded(
  url: string,
  dynamicM3U8Id: number | null,
  headerProfile: string | null | undefined
): string {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return url;
  if ((url.includes("/proxy/stream") || url.includes("/api/v1/proxy/stream")) && url.includes("url=")) {
    return url;
  }
  try {
    const id = dynamicM3U8Id == null ? undefined : dynamicM3U8Id;
    const hp = headerProfile?.trim() || undefined;
    return buildProxyStreamUrl(url, id == null && !hp ? undefined : { dynamicM3U8Id: id, headerProfile: hp });
  } catch {
    return url;
  }
}

const LINK_RETRY_ATTEMPTS = 3;
/** Shorter remount delay so we rotate to the next mirror quickly. */
const LINK_RETRY_DELAY_MS = 800;
const HLS_MANIFEST_MAX_RETRY = 3;
const HLS_LEVEL_MAX_RETRY = 2;
const HLS_FRAG_MAX_RETRY = 2;
const MAX_HLS_RECOVERY_ATTEMPTS = 4;
const RECONNECT_MSG = "Reconnecting…";
const URL_FAIL_COOLDOWN_MS = 5 * 60 * 1000;
const recentlyFailedUrlUntil = new Map<string, number>();

/** Fail over to the next URL instead of waiting ~10s per dead mirror (HLS.js defaults). */
const HLS_MANIFEST_LOAD_TIMEOUT_MS = 5500;
const HLS_LEVEL_LOAD_TIMEOUT_MS = 5500;
const HLS_FRAG_LOAD_TIMEOUT_MS = 9000;

function isUrlTemporarilyFailed(url: string): boolean {
  const until = recentlyFailedUrlUntil.get(url);
  if (!until) return false;
  if (until <= Date.now()) {
    recentlyFailedUrlUntil.delete(url);
    return false;
  }
  return true;
}

function markUrlFailed(url: string): void {
  if (!url) return;
  recentlyFailedUrlUntil.set(url, Date.now() + URL_FAIL_COOLDOWN_MS);
}

function prioritizeHealthyUrls(urls: string[]): string[] {
  if (urls.length <= 1) return urls;
  const healthy: string[] = [];
  const failed: string[] = [];
  for (const u of urls) {
    if (isUrlTemporarilyFailed(u)) failed.push(u);
    else healthy.push(u);
  }
  return healthy.concat(failed);
}

function parseGeoFromXhr(xhr: XMLHttpRequest): boolean {
  if (xhr.status !== 403 && xhr.status !== 401) return false;
  try {
    const j = JSON.parse(xhr.responseText) as { code?: string };
    if (j?.code === "GEO_RESTRICTED") return true;
  } catch {
    /* non-JSON body — not a confirmed geo-restriction */
  }
  return false;
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
  streamUrls,
  alternateUrls,
  title,
  isTheaterMode,
  onToggleTheaterMode,
  overlay,
  headerProfile = null,
  geoHint = false,
  channelLogoUrl = null,
  onStreamError,
}: PremiumPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const onStreamErrorRef = useRef(onStreamError);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<ReturnType<ReturnType<typeof dashjs.MediaPlayer>["create"]> | null>(null);
  /** After first `playing`, do not show the full-screen loader on routine rebuffering. */
  const playbackStartedRef = useRef(false);

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
  const [autoRetryCountdown, setAutoRetryCountdown] = useState(0);
  const [showExternalPanel, setShowExternalPanel] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [geoRestricted, setGeoRestricted] = useState(false);
  const isMobileSheet = useMatchMediaQuery("(max-width: 639px)");
  const isTouchDevice = useMatchMediaQuery("(pointer: coarse)");
  const externalPanelTitleId = useId();
  const [urlIdx, setUrlIdx] = useState(0);
  const urlPlayIndexRef = useRef(0);
  const linkRetryRef = useRef(0);
  const linkRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstHideDoneRef = useRef(false);
  /** Seek ripple feedback: direction "left"|"right" + dismiss timer */
  const [seekFeedback, setSeekFeedback] = useState<{ dir: "left" | "right"; secs: number; key: number } | null>(null);
  const seekFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Volume swipe overlay: shown while swiping, dismissed after gesture ends */
  const [volFeedback, setVolFeedback] = useState<number | null>(null);
  const volFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Tap hint — shows once per channel for 2s then auto-hides */
  const [showHint, setShowHint] = useState(false);
  const hintShownRef = useRef(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Sleep timer */
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState<number>(0);
  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stallCountRef = useRef(0);
  const hlsRecoveryRef = useRef(0);

  const [dataSaver, setDataSaver] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showScaleMenu, setShowScaleMenu] = useState(false);
  const [showStreamHealth, setShowStreamHealth] = useState(false);
  const [scaleMode, setScaleMode] = useState<VideoScaleMode>("cover");
  const [videoScale, setVideoScale] = useState(1);
  const [brightnessOverlay, setBrightnessOverlay] = useState(1);
  const [streamBitrate, setStreamBitrate] = useState("—");

  const resolvedDirect = useMemo(() => {
    if (streamUrls?.length) {
      return streamUrls.filter((u) => typeof u === "string" && u.trim().startsWith("http"));
    }
    return [streamUrl, ...(alternateUrls ?? [])].filter((u) => u && u.trim().startsWith("http"));
  }, [streamUrls, streamUrl, alternateUrls]);

  const streamIdentity = useMemo(() => resolvedDirect.join("\0"), [resolvedDirect]);

  const dynamicM3U8Id = useMemo(() => {
    for (const u of resolvedDirect) {
      const id = parseDynamicM3U8IdFromStreamUrl(u);
      if (id != null) return id;
    }
    return null;
  }, [resolvedDirect]);
  const directUrls = useMemo(() => {
    const base = resolvedDirect;
    if (dynamicM3U8Id == null) return base;
    return base.map((u) => buildProxyM3U8RequestUrl(u, dynamicM3U8Id));
  }, [resolvedDirect, dynamicM3U8Id]);
  const allUrlsList = useMemo(
    () => prioritizeHealthyUrls(buildOrderedStreamUrls(directUrls, dynamicM3U8Id, headerProfile)),
    [directUrls, dynamicM3U8Id, headerProfile]
  );
  const sharePlaybackUrl = allUrlsList[urlIdx] ?? allUrlsList[0] ?? streamUrl;

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
  }, []);

  const scheduleHideControls = useCallback(() => {
    clearHideTimer();
    const delay = firstHideDoneRef.current ? HIDE_CONTROLS_AFTER_MS : HIDE_CONTROLS_INITIAL_MS;
    firstHideDoneRef.current = true;
    hideTimerRef.current = setTimeout(() => setShowControls(false), delay);
  }, [clearHideTimer]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (isPlaying) scheduleHideControls();
  }, [isPlaying, scheduleHideControls]);

  useEffect(() => {
    try {
      setDataSaver(localStorage.getItem(DATA_SAVER_KEY) === "1");
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DATA_SAVER_KEY, dataSaver ? "1" : "0");
    } catch {
      /* */
    }
  }, [dataSaver]);

  useEffect(() => {
    if (isPlaying) warmBackupStreams(allUrlsList, urlIdx);
  }, [isPlaying, allUrlsList, urlIdx]);

  useEffect(() => {
    urlPlayIndexRef.current = 0;
    setUrlIdx(0);
    setIsSwitching(false);
    setGeoRestricted(false);
    linkRetryRef.current = 0;
    hlsRecoveryRef.current = 0;
    firstHideDoneRef.current = false;
    hintShownRef.current = false;
    setShowHint(false);
    if (hintTimerRef.current) { clearTimeout(hintTimerRef.current); hintTimerRef.current = null; }
    if (linkRetryTimerRef.current) {
      clearTimeout(linkRetryTimerRef.current);
      linkRetryTimerRef.current = null;
    }
  }, [streamIdentity]);

  useEffect(
    () => () => {
      if (linkRetryTimerRef.current) clearTimeout(linkRetryTimerRef.current);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (showControls) {
      setShowHint(false);
      if (hintTimerRef.current) { clearTimeout(hintTimerRef.current); hintTimerRef.current = null; }
      return;
    }
    if (!isPlaying || !isTouchDevice || hintShownRef.current) return;
    hintShownRef.current = true;
    setShowHint(true);
    hintTimerRef.current = setTimeout(() => setShowHint(false), 2000);
  }, [showControls, isPlaying, isTouchDevice]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const cleanup = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      if (dashRef.current) {
        try {
          dashRef.current.reset();
        } catch {
          /* */
        }
        dashRef.current = null;
      }
    };
    cleanup();
    setQualityOptions([{ label: "Auto", value: -1 }]);
    setSelectedQuality(-1);
    setBufferedPct(0);
    setIsLoading(true);
    setHasError(false);
    setGeoRestricted(false);
    playbackStartedRef.current = false;

    const allUrls = buildOrderedStreamUrls(directUrls, dynamicM3U8Id, headerProfile);
    if (!allUrls.length) {
      setIsLoading(false);
      setHasError(true);
      return cleanup;
    }
    const bounded = Math.min(Math.max(0, urlPlayIndexRef.current), allUrls.length - 1);
    urlPlayIndexRef.current = bounded;
    setUrlIdx(bounded);
    const effectiveUrl = allUrls[bounded] ?? allUrls[0]!;
    const isDash = isDashProxiedStreamUrl(effectiveUrl);

    const lightNet = isConstrainedNetwork() || dataSaver;
    if (isDash) {
      const player = dashjs.MediaPlayer().create();
      dashRef.current = player;
      player.updateSettings({
        streaming: { buffer: { bufferTimeAtTopQuality: lightNet ? 8 : 12 } },
      });
      player.initialize(video, effectiveUrl, true);
      const onError = () => {
        const cur = urlPlayIndexRef.current;
        markUrlFailed(allUrls[cur] ?? "");
        const nextIdx = cur + 1;
        if (nextIdx < allUrls.length) {
          urlPlayIndexRef.current = nextIdx;
          setUrlIdx(nextIdx);
          setIsSwitching(true);
          setIsLoading(true);
          /* dash.js typings omit in-place source swap; remount via retryKey like HLS destroy path */
          setRetryKey((k) => k + 1);
        } else {
          setIsSwitching(false);
          setHasError(true);
          setIsLoading(false);
        }
      };
      player.on(dashjs.MediaPlayer.events.ERROR, onError);
      const onStreamInitialized = () => {
        setIsLoading(false);
        setHasError(false);
        setIsSwitching(false);
        void video.play().catch(() => {
          video.muted = true;
          void video.play().catch(() => {});
        });
      };
      player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, onStreamInitialized);
      return cleanup;
    }

    if (Hls.isSupported()) {
      let hlsInstance: Hls | null = null;
      let tryFailover: (message?: string) => boolean = () => false;
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: !lightNet,
        maxBufferLength: lightNet ? 14 : 32,
        maxMaxBufferLength: lightNet ? 28 : 65,
        backBufferLength: lightNet ? 10 : 22,
        maxBufferSize: lightNet ? 28 * 1000 * 1000 : 65 * 1000 * 1000,
        maxBufferHole: 0.35,
        liveSyncDurationCount: lightNet ? 2 : 3,
        liveMaxLatencyDurationCount: lightNet ? 7 : 11,
        liveDurationInfinity: true,
        abrEwmaDefaultEstimate: lightNet ? 400_000 : 1_000_000,
        abrBandWidthFactor: lightNet ? 0.9 : 0.95,
        abrBandWidthUpFactor: lightNet ? 0.55 : 0.7,
        manifestLoadingTimeOut: HLS_MANIFEST_LOAD_TIMEOUT_MS,
        manifestLoadingMaxRetry: HLS_MANIFEST_MAX_RETRY,
        manifestLoadingRetryDelay: 400,
        levelLoadingTimeOut: HLS_LEVEL_LOAD_TIMEOUT_MS,
        levelLoadingMaxRetry: HLS_LEVEL_MAX_RETRY,
        levelLoadingRetryDelay: 400,
        fragLoadingTimeOut: HLS_FRAG_LOAD_TIMEOUT_MS,
        fragLoadingMaxRetry: HLS_FRAG_MAX_RETRY,
        fragLoadingRetryDelay: lightNet ? 650 : 450,
        startLevel: -1,
        capLevelToPlayerSize: true,
        xhrSetup: (xhr, requestUrl) => {
          const nextUrl = relayHlsXhrUrlIfNeeded(requestUrl, dynamicM3U8Id, headerProfile);
          if (nextUrl !== requestUrl) {
            xhr.open("GET", nextUrl, true);
          }
          const onEnd = () => {
            xhr.removeEventListener("loadend", onEnd);
            if (xhr.status >= 500 || xhr.status === 429) {
              if (tryFailover()) return;
              setIsLoading(false);
              setIsSwitching(false);
              hlsInstance?.destroy();
              if (hlsRef.current === hlsInstance) hlsRef.current = null;
              return;
            }
            if (!parseGeoFromXhr(xhr)) return;
            if (tryFailover()) {
              setGeoRestricted(false);
              return;
            }
            setGeoRestricted(true);
            setIsLoading(false);
            setIsSwitching(false);
            hlsInstance?.destroy();
            if (hlsRef.current === hlsInstance) hlsRef.current = null;
          };
          xhr.addEventListener("loadend", onEnd);
        },
      });
      hlsInstance = hls;
      hlsRef.current = hls;
      tryFailover = (): boolean => {
        const cur = urlPlayIndexRef.current;
        markUrlFailed(allUrls[cur] ?? "");
        const nextIdx = cur + 1;
        if (nextIdx >= allUrls.length || !hlsInstance) return false;
        urlPlayIndexRef.current = nextIdx;
        setUrlIdx(nextIdx);
        playbackStartedRef.current = false;
        setIsSwitching(true);
        setIsLoading(true);
        try {
          hls.loadSource(allUrls[nextIdx]!);
          hls.startLoad(-1);
        } catch {
          setIsSwitching(false);
          setHasError(true);
          setIsLoading(false);
          return false;
        }
        return true;
      };
      hls.loadSource(effectiveUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        const resp = (data as { response?: { code?: number } }).response;
        const httpCode = resp?.code;

        if (httpCode === 403 || httpCode === 401) {
          if (tryFailover()) return;
          setGeoRestricted(true);
          setIsLoading(false);
          setIsSwitching(false);
          return;
        }

        const isNet = data.type === Hls.ErrorTypes.NETWORK_ERROR;
        const isMedia = data.type === Hls.ErrorTypes.MEDIA_ERROR;
        const isManifest =
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR;
        const isFrag =
          data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.FRAG_PARSING_ERROR;

        if (hlsRecoveryRef.current < MAX_HLS_RECOVERY_ATTEMPTS) {
          hlsRecoveryRef.current += 1;
          if (isMedia) {
            try {
              hls.recoverMediaError();
              return;
            } catch {
              /* fall through */
            }
          }
          if (isNet || isManifest || isFrag) {
            try {
              hls.startLoad(-1);
              setIsLoading(true);
              return;
            } catch {
              /* fall through */
            }
          }
        }

        if (isNet || isManifest || isFrag) {
          const retries = linkRetryRef.current;
          if (retries < LINK_RETRY_ATTEMPTS - 1) {
            linkRetryRef.current = retries + 1;
            setIsLoading(true);
            setIsSwitching(true);
            if (linkRetryTimerRef.current) clearTimeout(linkRetryTimerRef.current);
            linkRetryTimerRef.current = setTimeout(() => {
              linkRetryTimerRef.current = null;
              setRetryKey((k) => k + 1);
            }, LINK_RETRY_DELAY_MS);
            return;
          }
          linkRetryRef.current = 0;
          if (tryFailover()) return;
        }

        setIsSwitching(false);
        setHasError(true);
        setIsLoading(false);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        linkRetryRef.current = 0;
        hlsRecoveryRef.current = 0;
        if (lightNet && hls.levels.length) {
          const underSd = hls.levels
            .map((level, idx) => (level.height && level.height <= 480 ? idx : -1))
            .filter((idx) => idx >= 0);
          if (underSd.length > 0) hls.autoLevelCapping = Math.max(...underSd);
        }
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

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setSelectedQuality(data.level);
        const level = hls.levels[data.level];
        if (level?.bitrate) setStreamBitrate(`${Math.round(level.bitrate / 1000)} kbps`);
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = effectiveUrl;
      setIsSwitching(false);
    }

    return cleanup;
  }, [streamIdentity, retryKey, directUrls, dynamicM3U8Id, headerProfile, dataSaver]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => { setIsPlaying(true); scheduleHideControls(); };
    const onPause = () => { setIsPlaying(false); setShowControls(true); clearHideTimer(); };
    const onVolumeChange = () => { setIsMuted(video.muted); setVolumeState(video.volume); };
    const onWaiting = () => {
      if (playbackStartedRef.current) {
        stallCountRef.current += 1;
        if (stallCountRef.current >= 3) {
          stallCountRef.current = 0;
          setRetryKey((k) => k + 1);
        }
        return;
      }
      setIsLoading(true);
    };
    const onPlaying = () => {
      playbackStartedRef.current = true;
      stallCountRef.current = 0;
      setIsLoading(false);
      setHasError(false);
      warmBackupStreams(allUrlsList, urlIdx);
    };
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
  }, [clearHideTimer, scheduleHideControls, allUrlsList, urlIdx]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  /* ── Touch gestures: double-tap seek (±10s) + vertical swipe for volume ── */
  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    let lastTapTime = 0;
    let lastTapX = 0;
    let touchStartY = 0;
    let touchStartX = 0;
    let touchStartVol = 1;
    let touchStartBright = 1;
    let touchStartScale = 1;
    let initialPinchDist = 0;
    let isSwiping = false;
    let swipeMode: "volume" | "brightness" | null = null;

    function showSeekRipple(dir: "left" | "right", secs: number) {
      if (seekFeedbackTimerRef.current) clearTimeout(seekFeedbackTimerRef.current);
      setSeekFeedback({ dir, secs, key: Date.now() });
      seekFeedbackTimerRef.current = setTimeout(() => setSeekFeedback(null), 900);
    }

    function showVolOverlay(vol: number) {
      if (volFeedbackTimerRef.current) clearTimeout(volFeedbackTimerRef.current);
      setVolFeedback(Math.round(vol * 100));
      volFeedbackTimerRef.current = setTimeout(() => setVolFeedback(null), 1200);
    }

    function showBrightOverlay(level: number) {
      if (volFeedbackTimerRef.current) clearTimeout(volFeedbackTimerRef.current);
      setVolFeedback(Math.round(level * 100));
      volFeedbackTimerRef.current = setTimeout(() => setVolFeedback(null), 1200);
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        const [a, b] = [e.touches[0]!, e.touches[1]!];
        initialPinchDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        touchStartScale = videoScale;
        return;
      }
      const touch = e.touches[0];
      if (!touch) return;
      const rect = container!.getBoundingClientRect();
      touchStartY = touch.clientY;
      touchStartX = touch.clientX - rect.left;
      touchStartVol = video!.volume;
      touchStartBright = brightnessOverlay;
      isSwiping = false;
      swipeMode = null;

      const now = Date.now();
      const tapX = touch.clientX - rect.left;
      if (now - lastTapTime < 300 && Math.abs(tapX - lastTapX) < rect.width * 0.6) {
        const isLeft = tapX < rect.width / 2;
        const seekDelta = isLeft ? -10 : 10;
        video!.currentTime = Math.max(0, video!.currentTime + seekDelta);
        showSeekRipple(isLeft ? "left" : "right", Math.abs(seekDelta));
        lastTapTime = 0;
      } else {
        lastTapTime = now;
        lastTapX = tapX;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && initialPinchDist > 0) {
        const [a, b] = [e.touches[0]!, e.touches[1]!];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const next = Math.min(2, Math.max(0.75, touchStartScale * (dist / initialPinchDist)));
        setVideoScale(next);
        return;
      }
      const touch = e.touches[0];
      if (!touch) return;
      const deltaY = touchStartY - touch.clientY;
      if (!isSwiping && Math.abs(deltaY) < 20) return;
      isSwiping = true;
      const rect = container!.getBoundingClientRect();
      if (!swipeMode) swipeMode = touchStartX < rect.width / 2 ? "brightness" : "volume";
      const delta = deltaY / rect.height;
      if (swipeMode === "volume") {
        const newVol = Math.min(1, Math.max(0, touchStartVol + delta));
        video!.volume = newVol;
        video!.muted = newVol === 0;
        setVolumeState(newVol);
        setIsMuted(newVol === 0);
        showVolOverlay(newVol);
      } else {
        const newBright = Math.min(1.4, Math.max(0.35, touchStartBright + delta * 0.8));
        setBrightnessOverlay(newBright);
        showBrightOverlay(Math.min(1, newBright));
      }
    }

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
    };
  }, [videoScale, brightnessOverlay]);

  /** Sync orientation when fullscreen is toggled via browser (e.g. ESC) or gesture. */
  useEffect(() => {
    if (!isMobileSheet) return;
    if (isFullscreen) {
      void tryLockLandscapePlayback();
    } else if (!isTheaterMode) {
      tryUnlockPlaybackOrientation();
    }
  }, [isMobileSheet, isFullscreen, isTheaterMode]);

  /** Auto PiP when player scrolls out of view */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (!entry.isIntersecting && isPlaying && document.pictureInPictureEnabled && videoRef.current && !document.pictureInPictureElement) {
          videoRef.current.requestPictureInPicture().catch(() => {});
        } else if (entry.isIntersecting && document.pictureInPictureElement === videoRef.current) {
          document.exitPictureInPicture().catch(() => {});
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(container);
    return () => obs.disconnect();
  }, [isPlaying]);

  useEffect(
    () => () => {
      tryUnlockPlaybackOrientation();
      clearHideTimer();
      hlsRef.current?.destroy();
    },
    [clearHideTimer]
  );

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
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      if (isMobileSheet && !isTheaterMode) tryUnlockPlaybackOrientation();
    } else {
      await el.requestFullscreen();
      if (isMobileSheet) await tryLockLandscapePlayback();
    }
  }, [isMobileSheet, isTheaterMode]);

  const retryStream = useCallback(() => {
    setHasError(false);
    setGeoRestricted(false);
    setIsLoading(true);
    setAutoRetryCountdown(0);
    linkRetryRef.current = 0;
    urlPlayIndexRef.current = 0;
    setUrlIdx(0);
    setRetryKey((k) => k + 1);
  }, []);

  const startSleepTimer = useCallback((minutes: number) => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleepMinutes(minutes);
    setSleepRemaining(minutes * 60);
    sleepTimerRef.current = setInterval(() => {
      setSleepRemaining((s) => {
        if (s <= 1) {
          clearInterval(sleepTimerRef.current!);
          setSleepMinutes(null);
          videoRef.current?.pause();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const cancelSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    setSleepMinutes(null);
    setSleepRemaining(0);
  }, []);

  // Cleanup sleep timer on unmount
  useEffect(() => () => { if (sleepTimerRef.current) clearInterval(sleepTimerRef.current); }, []);

  useEffect(() => {
    onStreamErrorRef.current = onStreamError;
  }, [onStreamError]);

  // Auto-retry countdown: when error or geo-block appears, count down then auto-retry
  useEffect(() => {
    if (!hasError && !geoRestricted) { setAutoRetryCountdown(0); return; }
    onStreamErrorRef.current?.();
    const secs = geoRestricted ? 15 : 10;
    setAutoRetryCountdown(secs);
    const interval = setInterval(() => {
      setAutoRetryCountdown((c) => {
        if (c <= 1) { clearInterval(interval); retryStream(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [hasError, geoRestricted, retryStream]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") return;
      switch (e.code) {
        case "Space": e.preventDefault(); void togglePlayPause(); break;
        case "KeyM": toggleMute(); break;
        case "KeyF": void toggleFullscreen(); break;
        case "KeyT":
          if (isMobileSheet) {
            if (!isTheaterMode) void tryLockLandscapePlayback();
            else if (!isFullscreen) tryUnlockPlaybackOrientation();
          }
          onToggleTheaterMode();
          break;
        case "ArrowUp": e.preventDefault(); setVolumeLevel(Math.min(1, volume + 0.1)); break;
        case "ArrowDown": e.preventDefault(); setVolumeLevel(Math.max(0, volume - 0.1)); break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    togglePlayPause,
    toggleMute,
    toggleFullscreen,
    onToggleTheaterMode,
    setVolumeLevel,
    volume,
    isMobileSheet,
    isTheaterMode,
    isFullscreen,
  ]);

  const currentQualityLabel = useMemo(() => {
    if (selectedQuality === -1) return "AUTO";
    return qualityOptions.find((o) => o.value === selectedQuality)?.label ?? "AUTO";
  }, [qualityOptions, selectedQuality]);

  const barQualityOptions = useMemo(
    () => (qualityOptions.length > 1 ? qualityOptions : BAR_QUALITY_OPTIONS),
    [qualityOptions],
  );

  const shareStream = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url: sharePlaybackUrl });
      } else {
        await navigator.clipboard.writeText(sharePlaybackUrl);
      }
    } catch {
      /* cancelled */
    }
  }, [title, sharePlaybackUrl]);

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const handlePlayerPointerLeave = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return;
    if (isPlaying) setShowControls(false);
  }, [isPlaying]);

  return (
    <motion.div
      ref={containerRef}
      className={`player-shell relative isolate overflow-hidden ${isTheaterMode ? "h-[75vh] min-h-[200px]" : "aspect-video"}`}
      style={{ overscrollBehavior: "none" }}
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
        className={`h-full w-full bg-black ${videoObjectClass(scaleMode, isMobileSheet && (isFullscreen || isTheaterMode))}`}
        style={{
          transform: `scale(${videoZoomScale(scaleMode) * videoScale})`,
          transformOrigin: "center center",
          filter: brightnessOverlay !== 1 ? `brightness(${brightnessOverlay})` : undefined,
        }}
        autoPlay
        playsInline
        controls={false}
        preload="metadata"
      />

      {/* Click-to-play */}
      <div className="absolute inset-0 z-10 cursor-pointer" onClick={() => void togglePlayPause()} />


      {/* ── Loading / Switching — Premium branded screen ── */}
      <AnimatePresence>
        {(isSwitching || (isLoading && !playbackStartedRef.current)) && !hasError && !geoRestricted && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5"
            style={{ background: "linear-gradient(160deg, rgba(5,6,12,0.95) 0%, rgba(12,10,22,0.95) 100%)", backdropFilter: "blur(8px)" }}
          >
            {/* Logo ring spinner */}
            <div className="relative flex h-[88px] w-[88px] items-center justify-center">
              {/* Outer spinning arc */}
              <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 88 88" fill="none">
                <circle cx="44" cy="44" r="40" stroke="rgba(245,166,35,0.12)" strokeWidth="3" />
                <motion.circle
                  cx="44" cy="44" r="40"
                  stroke="url(#spinGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="251"
                  animate={{ strokeDashoffset: [251, 30, 251] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
                <defs>
                  <linearGradient id="spinGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#F5A623" stopOpacity="0" />
                    <stop offset="60%" stopColor="#F5A623" stopOpacity="1" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.6" />
                  </linearGradient>
                </defs>
              </svg>
              {/* Inner subtle pulse ring */}
              <motion.div
                className="absolute inset-[10px] rounded-full"
                style={{ border: "1px solid rgba(245,166,35,0.15)" }}
                animate={{ scale: [1, 1.06, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Logo */}
              <div
                className="relative flex h-[56px] w-[56px] items-center justify-center rounded-xl overflow-hidden"
                style={{ background: "#fff", border: "1.5px solid rgba(245,166,35,0.5)", boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,166,35,0.1)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={channelLogoUrl || DEFAULT_PLAYER_BRAND_LOGO}
                  alt={title || "ABO Sports TV"}
                  className="h-[48px] w-[48px] object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_PLAYER_BRAND_LOGO; }}
                />
              </div>
            </div>

            {/* Text */}
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-[13px] font-bold tracking-wide text-white truncate max-w-[200px] text-center" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
                {title || "ABO SPORTS TV"}
              </p>
              <p className="text-[11px] font-medium tracking-[0.08em]" style={{ color: "rgba(245,166,35,0.75)" }}>
                {RECONNECT_MSG}
              </p>
            </div>

            {/* Shimmer progress bar */}
            <div className="h-[3px] w-36 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
              <motion.div
                className="h-full w-1/2 rounded-full"
                style={{ background: "linear-gradient(90deg, transparent, #F5A623, transparent)" }}
                animate={{ x: ["-100%", "300%"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error / Geo-restricted overlay ── */}
      <AnimatePresence>
        {(hasError || geoRestricted) && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 p-6"
            style={{ background: "linear-gradient(160deg, rgba(5,6,12,0.96) 0%, rgba(20,8,8,0.96) 100%)", backdropFilter: "blur(8px)" }}
          >
            {/* Icon */}
            <div className="relative flex h-16 w-16 items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: geoRestricted ? "rgba(99,102,241,0.12)" : "rgba(239,68,68,0.12)",
                  border: geoRestricted ? "1px solid rgba(99,102,241,0.35)" : "1px solid rgba(239,68,68,0.35)",
                }}
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              {geoRestricted ? (
                <Globe className="h-7 w-7 text-indigo-300" />
              ) : (
                <AlertTriangle className="h-7 w-7 text-red-400" />
              )}
            </div>
            {/* Message */}
            <div className="text-center space-y-1.5">
              <p className="text-sm font-bold text-white">
                {geoRestricted ? "Not available in your region" : "Unable to connect"}
              </p>
              <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                {geoRestricted || geoHint
                  ? <>এই চ্যানেলটি আপনার অঞ্চলে সীমাবদ্ধ।<br />
                    <span style={{ color: "rgba(167,139,250,0.8)" }}>① VPN (India/BD সার্ভার) চালু করুন অথবা<br/>② নিচের External Player ব্যবহার করুন।</span></>
                  : isConstrainedNetwork()
                  ? <>নেটওয়ার্ক সংযোগ দুর্বল।<br />WiFi বা ভালো 4G-তে চেষ্টা করুন।</>
                  : <>চ্যানেলটি এখন unavailable অথবা source পরিবর্তন হয়েছে।<br />External Player চেষ্টা করুন বা একটু পরে আবার চেষ্টা করুন।</>}
              </p>
              {autoRetryCountdown > 0 && (
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  <Loader2 size={11} className="animate-spin" style={{ color: "var(--primary-accent)" }} />
                  <p className="text-[11px] font-semibold" style={{ color: "var(--primary-accent)" }}>
                    {autoRetryCountdown}s — {RECONNECT_MSG}
                  </p>
                </div>
              )}
            </div>
            {/* Actions */}
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={retryStream}
                className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-white transition active:scale-95"
                style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.25), rgba(245,166,35,0.15))", border: "1px solid rgba(245,166,35,0.45)", boxShadow: "0 4px 12px rgba(245,166,35,0.15)" }}>
                <RefreshCw size={13} /> আবার চেষ্টা
              </button>
              <button type="button" onClick={() => window.open(sharePlaybackUrl, "_blank", "noopener,noreferrer")}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition hover:bg-white/10 active:scale-95"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}>
                <ExternalLink size={13} /> Tab-এ খুলুন
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Player header — single LIVE badge + channel + quality */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center gap-2 px-3 py-2 sm:px-4"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}
      >
        {isFullscreen ? (
          <button
            type="button"
            onClick={() => void document.exitFullscreen()}
            className="glass-player-header pointer-events-auto flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold text-white"
            aria-label="Exit fullscreen"
          >
            <ChevronLeft size={16} /> Back
          </button>
        ) : null}
        <div className="glass-player-header pointer-events-none flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-1.5">
          <p className="min-w-0 flex-1 truncate text-xs font-bold text-white sm:text-sm">{title}</p>
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white"
            style={{ background: "rgba(220,38,38,0.75)", border: "1px solid rgba(255,82,82,0.35)" }}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            LIVE
          </span>
          {selectedQuality !== -1 ? (
            <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase text-white/80" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {currentQualityLabel}
            </span>
          ) : null}
        </div>
      </div>

      {/* Custom overlay */}
      {overlay}

      {/* ── Seek ripple overlay (double-tap ±10s) ── */}
      <AnimatePresence>
        {seekFeedback && (
          <motion.div
            key={`seek-${seekFeedback.key}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-0 z-35 flex items-center"
          >
            <div className={`absolute flex flex-col items-center gap-1 ${seekFeedback.dir === "left" ? "left-[8%]" : "right-[8%]"}`}>
              <motion.div
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.3)", backdropFilter: "blur(4px)" }}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.1, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className="text-xl font-black" style={{ color: "#F5A623" }}>
                  {seekFeedback.dir === "left" ? "«" : "»"}
                </span>
              </motion.div>
              <motion.span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                style={{ background: "rgba(0,0,0,0.5)", color: "#F5A623" }}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                {seekFeedback.dir === "left" ? `-${seekFeedback.secs}s` : `+${seekFeedback.secs}s`}
              </motion.span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Volume swipe indicator ── */}
      <AnimatePresence>
        {volFeedback !== null && (
          <motion.div
            key="vol-indicator"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute left-1/2 top-1/2 z-35 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
            style={{ backdropFilter: "blur(12px)" }}
          >
            <div
              className="flex flex-col items-center gap-2 rounded-2xl px-6 py-4"
              style={{ background: "rgba(10,11,18,0.82)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
            >
              <VolumeIcon size={22} style={{ color: volFeedback === 0 ? "#ef4444" : "#F5A623" }} />
              {/* Bar */}
              <div className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.12)" }}>
                <div
                  className="h-full rounded-full transition-all duration-75"
                  style={{ width: `${volFeedback}%`, background: volFeedback === 0 ? "#ef4444" : "linear-gradient(90deg, #F5A623, #f59e0b)" }}
                />
              </div>
              <span className="text-xs font-bold tabular-nums text-white">{volFeedback}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "Tap to show controls" hint — auto-hides after 2s, shown once per channel */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            key="tap-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
          >
            <span
              className="rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-wide"
              style={{ background: "rgba(0,0,0,0.38)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(4px)" }}
            >
              স্পর্শ করুন · ডাবল ট্যাপ ±10s
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Controls panel ── */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            key="controls"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-x-0 bottom-0 z-40"
          >
            {/* Live buffer bar — edge-to-edge at very bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: "rgba(255,255,255,0.06)", zIndex: 1 }}>
              <motion.div
                className="h-full rounded-r-full"
                style={{ background: "linear-gradient(90deg, #F5A623 0%, #f59e0b 60%, rgba(245,166,35,0.4) 100%)" }}
                animate={{ width: `${bufferedPct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>

            <div
              className="glass-player-bar mx-2 mb-[7px] overflow-hidden rounded-2xl sm:mx-3"
            >
              <div className="flex items-center gap-1.5 px-2.5 py-2 sm:gap-2 sm:px-4 sm:py-2.5">
                {/* Play / Pause — primary CTA */}
                <button
                  type="button"
                  onClick={() => void togglePlayPause()}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="shrink-0 flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-90"
                  style={{
                    background: isPlaying ? "rgba(245,166,35,0.22)" : "rgba(255,255,255,0.12)",
                    border: isPlaying ? "1.5px solid rgba(245,166,35,0.6)" : "1.5px solid rgba(255,255,255,0.18)",
                    color: isPlaying ? "#F5A623" : "#fff",
                    boxShadow: isPlaying ? "0 0 18px rgba(245,166,35,0.18)" : "none",
                  }}
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
                </button>

                {/* Volume */}
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label="Mute"
                  className="control-btn shrink-0 active:scale-90 transition"
                >
                  <VolumeIcon size={17} />
                </button>
                {!isTouchDevice && (
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolumeLevel(Number(e.target.value))}
                    className="volume-slider w-14 shrink-0 sm:w-20"
                    aria-label="Volume"
                  />
                )}

                {/* Record (UI only — no backend) */}
                <button
                  type="button"
                  aria-label="Record"
                  title="Record"
                  className="control-btn shrink-0 opacity-50 active:scale-90 transition"
                  disabled
                >
                  <Circle size={16} />
                </button>

                {/* Scaling */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowScaleMenu((v) => !v)}
                    aria-label="Scaling"
                    title="Scaling"
                    className="control-btn active:scale-90 transition"
                    style={showScaleMenu ? { background: "rgba(245,166,35,0.2)", borderColor: "rgba(245,166,35,0.5)", color: "#F5A623" } : {}}
                  >
                    <Scaling size={16} />
                  </button>
                  {showScaleMenu && (
                    <div
                      className="absolute bottom-full right-0 z-50 mb-2 min-w-[9rem] overflow-hidden rounded-xl border border-white/10 py-1 shadow-2xl"
                      style={{ background: "rgba(10,11,18,0.92)", backdropFilter: "blur(16px)" }}
                    >
                      {SCALE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => { setScaleMode(opt.id); setShowScaleMenu(false); }}
                          className="block w-full px-3 py-1.5 text-left text-[11px] font-semibold transition hover:bg-white/10"
                          style={{ color: scaleMode === opt.id ? "#F5A623" : "rgba(255,255,255,0.75)" }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <select
                  value={selectedQuality}
                  onChange={(e) => changeQuality(Number(e.target.value))}
                  aria-label="Quality"
                  className="quality-select h-8 max-w-[4.5rem] shrink-0 rounded-lg border border-white/10 bg-black/25 px-1.5 text-[10px] font-semibold text-white"
                >
                  {barQualityOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                {typeof document !== "undefined" && document.pictureInPictureEnabled && (
                  <button
                    type="button"
                    onClick={() => void togglePictureInPicture()}
                    aria-label="Picture-in-Picture"
                    title="PiP"
                    className="control-btn shrink-0 active:scale-90 transition"
                  >
                    <PictureInPicture2 size={16} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void shareStream()}
                  aria-label="Share"
                  title="Share"
                  className="control-btn shrink-0 active:scale-90 transition"
                >
                  <Share2 size={16} />
                </button>

                <div className="flex-1" />

                <button
                  type="button"
                  onClick={() => setShowSettingsPanel(true)}
                  aria-label="Settings"
                  title="Settings"
                  className="control-btn shrink-0 active:scale-90 transition"
                  style={showSettingsPanel ? { background: "rgba(245,166,35,0.2)", borderColor: "rgba(245,166,35,0.5)", color: "#F5A623" } : {}}
                >
                  <Settings size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  title="Fullscreen (F)"
                  className="control-btn shrink-0 active:scale-90 transition"
                  style={isFullscreen ? { background: "rgba(245,166,35,0.2)", borderColor: "rgba(245,166,35,0.5)", color: "#F5A623" } : {}}
                >
                  {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                </button>
              </div>

              {/* External players — inline on sm+, portal bottom-sheet on mobile */}
              {!isMobileSheet && (
                <div
                  className="grid transition-[grid-template-rows] duration-200 ease-out"
                  style={{ gridTemplateRows: showExternalPanel ? "1fr" : "0fr" }}
                >
                  <div className="min-h-0 overflow-hidden">
                    {showExternalPanel && (
                      <div className="border-t border-white/[0.06] px-3 pb-4 pt-3 sm:px-4">
                        <ExternalPlayerPicker
                          idPrefix={externalPanelTitleId}
                          streamUrl={sharePlaybackUrl}
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
                    streamUrl={sharePlaybackUrl}
                    onClose={() => setShowExternalPanel(false)}
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {showStreamHealth && (
        <div
          className="pointer-events-none absolute right-3 top-14 z-40 rounded-lg px-2 py-1 font-mono text-[9px] text-emerald-300/90"
          style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(16,185,129,0.25)" }}
        >
          <div>{streamBitrate}</div>
          <div>Q: {currentQualityLabel}</div>
          <div>M {urlIdx + 1}/{allUrlsList.length}</div>
        </div>
      )}

      <PlayerSettingsPanel
        open={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        dataSaver={dataSaver}
        onDataSaverChange={setDataSaver}
        selectedQuality={selectedQuality}
        qualityOptions={qualityOptions}
        onQualityChange={changeQuality}
        showStreamHealth={showStreamHealth}
        onToggleStreamHealth={setShowStreamHealth}
        streamHealth={{
          bitrate: streamBitrate,
          level: currentQualityLabel,
          urlIndex: urlIdx,
          totalUrls: allUrlsList.length,
        }}
        scaleMode={scaleMode}
        onScaleModeChange={setScaleMode}
        onTogglePictureInPicture={() => void togglePictureInPicture()}
        pipEnabled={typeof document !== "undefined" && document.pictureInPictureEnabled}
        sleepMinutes={sleepMinutes}
        sleepRemaining={sleepRemaining}
        onStartSleepTimer={startSleepTimer}
        onCancelSleepTimer={cancelSleepTimer}
      />
    </motion.div>
  );
}
