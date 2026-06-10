"use client";

import * as dashjs from "dashjs";
import Hls from "hls.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ExternalPlayerPicker } from "@/components/player/ExternalPlayerPicker";
import { PlayerControlBar } from "@/components/player/PlayerControlBar";
import {
  PlayerSettingsPanel,
  type AudioTrackOption,
  type SubtitleTrackOption,
} from "@/components/player/PlayerSettingsPanel";
import {
  buildHlsConfig,
  downgradeHlsQuality,
  isConstrainedNetwork,
  isMobilePlayback,
  linkRetryDelayMs,
  LINK_RETRY_ATTEMPTS,
  MAX_HLS_RECOVERY_ATTEMPTS,
  StreamHealthTracker,
  trySilentHlsRecovery,
  upgradeHlsQuality,
} from "@/lib/hlsPlayback";
import { warmBackupStreams } from "@/lib/streamWarmup";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildProxyM3U8RequestUrl,
  buildProxyStreamUrl,
  isDashProxiedStreamUrl,
  parseDynamicM3U8IdFromStreamUrl,
} from "@/lib/streamRelay";
import { BRAND } from "@/lib/branding";

/* ─────────────────────────────────────────────────────────── Types ── */
type QualityOption = { label: string; value: number };

export type VideoScaleMode = "contain" | "cover" | "stretch" | "original" | "zoom1" | "zoom1.5" | "zoom2";

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
  /** Priority 1 — live match / event title overlay. */
  liveMatchTitle?: string | null;
  /** Priority 2 — EPG current program title. */
  epgProgramTitle?: string | null;
  /** Called when all stream sources have errored out. */
  onStreamError?: () => void;
  /** Live IPTV hides seek bar and shows LIVE badge only. */
  isLive?: boolean;
};

/** App brand logo for loading, buffering, and fallback states. */
const DEFAULT_PLAYER_BRAND_LOGO = BRAND.logo.png;
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

type NativeAudioTrackList = {
  length: number;
  [i: number]: { id: string; label: string; enabled: boolean } | undefined;
};

type HlsAudioTrackList = Hls & {
  audioTracks?: { name?: string; lang?: string; groupId?: string }[];
  audioTrack?: number;
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
const HIDE_CONTROLS_AFTER_MS = 3000;

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

const LOADING_MSG = "Loading stream…";
const RECONNECT_MSG = "Reconnecting…";
const RETRY_KEY_MIN_INTERVAL_MS = 2000;
const URL_FAIL_COOLDOWN_MS = 90 * 1000;
const RUNNING_PLAYBACK_ERROR_GRACE_MS = 15_000;
const SERVER_WAKE_RETRY_DELAYS_MS = [8000, 15000, 30000];
const recentlyFailedUrlUntil = new Map<string, number>();

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
  if (xhr.status !== 403 && xhr.status !== 401 && xhr.status !== 451) return false;
  try {
    const j = JSON.parse(xhr.responseText) as { code?: string };
    if (j?.code === "GEO_RESTRICTED") return true;
  } catch {
    /* non-JSON body — not a confirmed geo-restriction */
  }
  return false;
}

function canTryDirectPlaybackUrl(url: string): boolean {
  if (!url.startsWith("http")) return false;
  if (typeof window !== "undefined" && window.location.protocol === "https:" && url.startsWith("http://")) {
    return false;
  }
  return true;
}

function dedupePlaybackUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function formatQualityFromHeight(height: number): string {
  if (height >= 2160) return "4K";
  if (height >= 1080) return "1080p";
  if (height >= 720) return "720p";
  if (height >= 480) return "480p";
  return `${height}p`;
}

/* ═══════════════════════════════════════════════════════ Component ═══ */
function brightnessPctToFilter(pct: number): number {
  return 0.35 + ((pct - 10) / 90) * 0.65;
}

function brightnessPctToDimOpacity(pct: number): number {
  return Math.max(0, ((100 - pct) / 100) * 0.62);
}

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
  liveMatchTitle = null,
  epgProgramTitle = null,
  onStreamError,
  isLive = true,
}: PremiumPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const onStreamErrorRef = useRef(onStreamError);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<ReturnType<ReturnType<typeof dashjs.MediaPlayer>["create"]> | null>(null);
  /** After first `playing`, do not show the full-screen loader on routine rebuffering. */
  const playbackStartedRef = useRef(false);
  const everPlayedRef = useRef(false);
  const loadGenRef = useRef(0);
  const lastRetryAtRef = useRef(0);
  const retryPendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stablePlaybackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningIssueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningIssueExpiredRef = useRef(false);
  const serverWakeRetryRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([{ label: "Auto", value: -1 }]);
  const [selectedQuality, setSelectedQuality] = useState(-1);
  const [bufferedPct, setBufferedPct] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [everPlayed, setEverPlayed] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [serverWaking, setServerWaking] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const autoRetryCountRef = useRef(0);
  const MAX_AUTO_RETRIES = 5;
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
  /** Volume swipe overlay: shown while swiping, dismissed after gesture ends */
  const [volFeedback, setVolFeedback] = useState<number | null>(null);
  const volFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Tap hint — shows once per channel for 2s then auto-hides */
  const [showHint, setShowHint] = useState(false);
  const hintShownRef = useRef(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stallCountRef = useRef(0);
  const hlsRecoveryRef = useRef(0);
  const healthTrackerRef = useRef<StreamHealthTracker | null>(null);
  const isMobilePlayer = useMemo(() => isMobilePlayback(), []);

  const [dataSaver, setDataSaver] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [scaleMode] = useState<VideoScaleMode>("cover");
  const [videoScale, setVideoScale] = useState(1);
  const [brightnessPct, setBrightnessPct] = useState(100);
  const [streamBitrate, setStreamBitrate] = useState("—");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [lowLatencyMode, setLowLatencyMode] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AudioTrackOption[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState("default");
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrackOption[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState("off");
  const [pipActive, setPipActive] = useState(false);
  const [streamResolution, setStreamResolution] = useState("—");
  const [streamCodec, setStreamCodec] = useState("HLS");
  const lastTapRef = useRef(0);

  const canAutoReloadBeforePlayback = useCallback(
    () => !playbackStartedRef.current && !everPlayedRef.current,
    []
  );

  const clearRunningIssueTimer = useCallback(() => {
    if (runningIssueTimerRef.current) {
      clearTimeout(runningIssueTimerRef.current);
      runningIssueTimerRef.current = null;
    }
    runningIssueExpiredRef.current = false;
  }, []);

  const keepRunningPlaybackOnIssue = useCallback(() => {
    if (canAutoReloadBeforePlayback()) return false;
    if (runningIssueExpiredRef.current) return false;
    setIsSwitching(false);
    setIsLoading(false);
    setHasError(false);
    setGeoRestricted(false);
    setIsBuffering(true);
    if (!runningIssueTimerRef.current) {
      runningIssueTimerRef.current = setTimeout(() => {
        runningIssueTimerRef.current = null;
        runningIssueExpiredRef.current = true;
        setIsBuffering(false);
        setHasError(true);
        onStreamErrorRef.current?.();
      }, RUNNING_PLAYBACK_ERROR_GRACE_MS);
    }
    return true;
  }, [canAutoReloadBeforePlayback]);

  const scheduleRetryKey = useCallback(() => {
    if (!canAutoReloadBeforePlayback()) return;
    if (retryPendingRef.current) clearTimeout(retryPendingRef.current);
    const elapsed = Date.now() - lastRetryAtRef.current;
    const delay = Math.max(300, elapsed >= RETRY_KEY_MIN_INTERVAL_MS ? 300 : RETRY_KEY_MIN_INTERVAL_MS - elapsed);
    retryPendingRef.current = setTimeout(() => {
      retryPendingRef.current = null;
      lastRetryAtRef.current = Date.now();
      setRetryKey((k) => k + 1);
    }, delay);
  }, [canAutoReloadBeforePlayback]);

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
    () =>
      prioritizeHealthyUrls(
        dedupePlaybackUrls([
          ...buildOrderedStreamUrls(directUrls, dynamicM3U8Id, headerProfile),
          ...resolvedDirect.filter(canTryDirectPlaybackUrl),
        ]),
      ),
    [directUrls, dynamicM3U8Id, headerProfile, resolvedDirect]
  );
  const sharePlaybackUrl = allUrlsList[urlIdx] ?? allUrlsList[0] ?? streamUrl;
  const externalPlaybackUrl = resolvedDirect[urlIdx] ?? resolvedDirect[0] ?? streamUrl;

  const attemptVideoPlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return false;
    try {
      await video.play();
      setNeedsUserGesture(false);
      return true;
    } catch {
      try {
        video.muted = true;
        await video.play();
        setNeedsUserGesture(false);
        return true;
      } catch {
        setNeedsUserGesture(true);
        setShowControls(true);
        setIsLoading(false);
        setIsBuffering(false);
        return false;
      }
    }
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
  }, []);

  const scheduleHideControls = useCallback(() => {
    clearHideTimer();
    firstHideDoneRef.current = true;
    hideTimerRef.current = setTimeout(() => setShowControls(false), HIDE_CONTROLS_AFTER_MS);
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
    urlPlayIndexRef.current = 0;
    setUrlIdx(0);
    setIsSwitching(false);
    setNeedsUserGesture(false);
    setGeoRestricted(false);
    setServerWaking(false);
    setEverPlayed(false);
    everPlayedRef.current = false;
    playbackStartedRef.current = false;
    linkRetryRef.current = 0;
    hlsRecoveryRef.current = 0;
    serverWakeRetryRef.current = 0;
    stallCountRef.current = 0;
    firstHideDoneRef.current = false;
    hintShownRef.current = false;
    setShowHint(false);
    if (hintTimerRef.current) { clearTimeout(hintTimerRef.current); hintTimerRef.current = null; }
    if (linkRetryTimerRef.current) {
      clearTimeout(linkRetryTimerRef.current);
      linkRetryTimerRef.current = null;
    }
    if (retryPendingRef.current) {
      clearTimeout(retryPendingRef.current);
      retryPendingRef.current = null;
    }
    if (stablePlaybackTimerRef.current) {
      clearTimeout(stablePlaybackTimerRef.current);
      stablePlaybackTimerRef.current = null;
    }
    clearRunningIssueTimer();
  }, [streamIdentity, clearRunningIssueTimer]);

  useEffect(
    () => () => {
      if (linkRetryTimerRef.current) clearTimeout(linkRetryTimerRef.current);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (runningIssueTimerRef.current) clearTimeout(runningIssueTimerRef.current);
      runningIssueExpiredRef.current = false;
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
    const loadGen = ++loadGenRef.current;
    const cleanup = () => {
      try {
        video.pause();
      } catch {
        /* */
      }
      healthTrackerRef.current?.destroy();
      healthTrackerRef.current = null;
      const hls = hlsRef.current;
      if (hls) {
        try {
          hls.stopLoad();
          hls.detachMedia();
          hls.destroy();
        } catch {
          /* */
        }
      }
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
    setHasError(false);
    setNeedsUserGesture(false);
    setGeoRestricted(false);
    const resumePlayback = everPlayedRef.current;
    if (resumePlayback) {
      setIsBuffering(true);
    } else {
      playbackStartedRef.current = false;
      setIsLoading(true);
    }

    const allUrls = dedupePlaybackUrls([
      ...buildOrderedStreamUrls(directUrls, dynamicM3U8Id, headerProfile),
      ...resolvedDirect.filter(canTryDirectPlaybackUrl),
    ]);
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
    const mobileNet = isMobilePlayer || lightNet;
    const useLowLatency = lowLatencyMode && !lightNet && !mobileNet;
    if (isDash) {
      const player = dashjs.MediaPlayer().create();
      dashRef.current = player;
      player.updateSettings({
        streaming: { buffer: { bufferTimeAtTopQuality: lightNet ? 8 : 12 } },
      });
      player.initialize(video, effectiveUrl, true);
      const onError = () => {
        if (keepRunningPlaybackOnIssue()) return;
        const cur = urlPlayIndexRef.current;
        markUrlFailed(allUrls[cur] ?? "");
        const nextIdx = cur + 1;
        if (nextIdx < allUrls.length) {
          urlPlayIndexRef.current = nextIdx;
          setUrlIdx(nextIdx);
          if (everPlayedRef.current) {
            setIsBuffering(true);
          } else {
            setIsSwitching(true);
            setIsLoading(true);
          }
          scheduleRetryKey();
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
        void attemptVideoPlayback();
      };
      player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, onStreamInitialized);
      return cleanup;
    }

    if (Hls.isSupported()) {
      let hlsInstance: Hls | null = null;
      let tryFailover: (message?: string) => boolean = () => false;
      const healthTracker = new StreamHealthTracker(
        () => {
          if (hlsRef.current) downgradeHlsQuality(hlsRef.current);
        },
        () => {
          if (hlsRef.current?.autoLevelEnabled) upgradeHlsQuality(hlsRef.current);
        }
      );
      healthTracker.reset();
      healthTracker.startStableWatch();
      healthTrackerRef.current = healthTracker;

      const hls = new Hls({
        ...buildHlsConfig({ lightNet, mobile: mobileNet }),
        lowLatencyMode: useLowLatency,
        xhrSetup: (xhr, requestUrl) => {
          const nextUrl = relayHlsXhrUrlIfNeeded(requestUrl, dynamicM3U8Id, headerProfile);
          if (nextUrl !== requestUrl) {
            xhr.open("GET", nextUrl, true);
          }
          const onEnd = () => {
            xhr.removeEventListener("loadend", onEnd);
            if (xhr.status === 503) {
              if (keepRunningPlaybackOnIssue()) return;
              // Backend is hibernating (Render free tier) — show waking message and retry after delay
              setServerWaking(true);
              if (everPlayedRef.current) {
                setIsBuffering(true);
              } else {
                setIsLoading(true);
              }
              if (linkRetryTimerRef.current) clearTimeout(linkRetryTimerRef.current);
              const wakeAttempt = Math.min(serverWakeRetryRef.current, SERVER_WAKE_RETRY_DELAYS_MS.length - 1);
              serverWakeRetryRef.current += 1;
              linkRetryTimerRef.current = setTimeout(() => {
                linkRetryTimerRef.current = null;
                setServerWaking(false);
                if (loadGen === loadGenRef.current) scheduleRetryKey();
              }, SERVER_WAKE_RETRY_DELAYS_MS[wakeAttempt]);
              return;
            }
            serverWakeRetryRef.current = 0;
            setServerWaking(false);
            if (xhr.status === 403 || xhr.status === 401) {
              if (tryFailover()) {
                setGeoRestricted(false);
                return;
              }
              if (keepRunningPlaybackOnIssue()) return;
              if (parseGeoFromXhr(xhr)) {
                setGeoRestricted(true);
              } else {
                setHasError(true);
              }
              setIsLoading(false);
              setIsSwitching(false);
              return;
            }
            if (xhr.status >= 500 || xhr.status === 429) {
              if (tryFailover()) return;
              if (keepRunningPlaybackOnIssue()) return;
              setIsLoading(false);
              setIsSwitching(false);
              setHasError(true);
              hlsInstance?.destroy();
              if (hlsRef.current === hlsInstance) hlsRef.current = null;
              return;
            }
          };
          xhr.addEventListener("loadend", onEnd);
        },
      });
      hlsInstance = hls;
      hlsRef.current = hls;
      tryFailover = (): boolean => {
        if (!canAutoReloadBeforePlayback()) return false;
        const cur = urlPlayIndexRef.current;
        markUrlFailed(allUrls[cur] ?? "");
        const nextIdx = cur + 1;
        if (nextIdx >= allUrls.length || !hlsInstance) return false;
        urlPlayIndexRef.current = nextIdx;
        setUrlIdx(nextIdx);
        if (everPlayedRef.current) {
          setIsBuffering(true);
        } else {
          setIsSwitching(true);
          playbackStartedRef.current = false;
          setIsLoading(true);
        }
        try {
          hls.stopLoad();
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

      const handleFatalHlsError = (data: { type: string; details: string; fatal: boolean; response?: { code?: number } }) => {
        healthTracker.recordError();
        const httpCode = data.response?.code;

        if (httpCode === 403 || httpCode === 401 || httpCode === 451) {
          if (tryFailover()) return;
          if (keepRunningPlaybackOnIssue()) return;
          if (httpCode === 451) {
            setGeoRestricted(true);
          } else {
            setHasError(true);
          }
          setIsLoading(false);
          setIsSwitching(false);
          return;
        }

        const isNet = data.type === Hls.ErrorTypes.NETWORK_ERROR;
        const isMedia = data.type === Hls.ErrorTypes.MEDIA_ERROR;
        const isManifest =
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
          data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR;
        const isLevel =
          data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT;
        const isFrag =
          data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT ||
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
          if (isNet || isManifest || isLevel || isFrag) {
            if (trySilentHlsRecovery(hls)) {
              if (!playbackStartedRef.current) setIsLoading(true);
              return;
            }
          }
        }

        if (isNet || isManifest || isLevel || isFrag) {
          const retries = linkRetryRef.current;
          if (canAutoReloadBeforePlayback() && retries < LINK_RETRY_ATTEMPTS - 1) {
            linkRetryRef.current = retries + 1;
            if (!playbackStartedRef.current && !everPlayedRef.current) {
              setIsLoading(true);
              setIsSwitching(true);
            } else {
              setIsBuffering(true);
            }
            if (linkRetryTimerRef.current) clearTimeout(linkRetryTimerRef.current);
            linkRetryTimerRef.current = setTimeout(() => {
              linkRetryTimerRef.current = null;
              if (loadGen === loadGenRef.current) scheduleRetryKey();
            }, linkRetryDelayMs(retries));
            return;
          }
          linkRetryRef.current = 0;
          if (canAutoReloadBeforePlayback() && tryFailover()) return;
        }

        if (keepRunningPlaybackOnIssue()) return;
        setIsSwitching(false);
        setHasError(true);
        setIsLoading(false);
      };

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) {
          if (
            data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
            data.details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL
          ) {
            healthTracker.recordStall();
            if (playbackStartedRef.current) trySilentHlsRecovery(hls);
          } else if (
            data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR ||
            data.details === Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT ||
            data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT
          ) {
            healthTracker.recordError();
          }
          return;
        }
        handleFatalHlsError(data);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        linkRetryRef.current = 0;
        hlsRecoveryRef.current = 0;
        healthTracker.reset();
        healthTracker.startStableWatch();
        if ((lightNet || mobileNet) && hls.levels.length) {
          const underSd = hls.levels
            .map((level, idx) => (level.height && level.height <= 480 ? idx : -1))
            .filter((idx) => idx >= 0);
          if (underSd.length > 0) hls.autoLevelCapping = Math.max(...underSd);
        }
        setHasError(false);
        setNeedsUserGesture(false);
        setIsSwitching(false);
        void attemptVideoPlayback();
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
        if (level?.height) setStreamResolution(`${level.height}p`);
        if (level?.codecSet) setStreamCodec(level.codecSet.split(",")[0] ?? "HLS");
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = effectiveUrl;
      video.load();
      setIsSwitching(false);
      const onNativeReady = () => {
        setHasError(false);
        setNeedsUserGesture(false);
        setIsLoading(false);
        setIsSwitching(false);
        void attemptVideoPlayback();
      };
      const onNativeError = (event: Event) => {
        event.stopImmediatePropagation();
        const cur = urlPlayIndexRef.current;
        markUrlFailed(allUrls[cur] ?? "");
        const nextIdx = cur + 1;
        if (canAutoReloadBeforePlayback() && nextIdx < allUrls.length && loadGen === loadGenRef.current) {
          urlPlayIndexRef.current = nextIdx;
          setUrlIdx(nextIdx);
          if (everPlayedRef.current) {
            setIsBuffering(true);
          } else {
            playbackStartedRef.current = false;
            setIsLoading(true);
            setIsSwitching(true);
          }
          video.src = allUrls[nextIdx]!;
          video.load();
          void attemptVideoPlayback();
          return;
        }
        setIsBuffering(false);
        setIsLoading(false);
        setIsSwitching(false);
        if (keepRunningPlaybackOnIssue()) return;
        setHasError(true);
      };
      video.addEventListener("loadedmetadata", onNativeReady);
      video.addEventListener("canplay", onNativeReady);
      video.addEventListener("error", onNativeError);
      void attemptVideoPlayback();
      return () => {
        video.removeEventListener("loadedmetadata", onNativeReady);
        video.removeEventListener("canplay", onNativeReady);
        video.removeEventListener("error", onNativeError);
        cleanup();
      };
    }

    return cleanup;
  }, [
    streamIdentity,
    retryKey,
    directUrls,
    resolvedDirect,
    dynamicM3U8Id,
    headerProfile,
    isMobilePlayer,
    dataSaver,
    lowLatencyMode,
    scheduleRetryKey,
    attemptVideoPlayback,
    canAutoReloadBeforePlayback,
    keepRunningPlaybackOnIssue,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => { setIsPlaying(true); scheduleHideControls(); };
    const onPause = () => { setIsPlaying(false); setShowControls(true); clearHideTimer(); };
    const onVolumeChange = () => { setIsMuted(video.muted); setVolumeState(video.volume); };
    const onWaiting = () => {
      healthTrackerRef.current?.recordStall();
      if (playbackStartedRef.current) {
        setIsBuffering(true);
        keepRunningPlaybackOnIssue();
        const hls = hlsRef.current;
        if (hls && trySilentHlsRecovery(hls)) return;
        stallCountRef.current += 1;
        return;
      }
      setIsLoading(true);
    };
    const onPlaying = () => {
      clearRunningIssueTimer();
      setIsBuffering(false);
      playbackStartedRef.current = true;
      everPlayedRef.current = true;
      setEverPlayed(true);
      autoRetryCountRef.current = 0;
      stallCountRef.current = 0;
      hlsRecoveryRef.current = 0;
      serverWakeRetryRef.current = 0;
      setNeedsUserGesture(false);
      healthTrackerRef.current?.recordPlaying();
      setIsLoading(false);
      setHasError(false);
      if (stablePlaybackTimerRef.current) clearTimeout(stablePlaybackTimerRef.current);
      stablePlaybackTimerRef.current = setTimeout(() => {
        stablePlaybackTimerRef.current = null;
        warmBackupStreams(allUrlsList, urlIdx);
      }, 10_000);
    };
    const onCanPlay = () => {
      clearRunningIssueTimer();
      setIsLoading(false);
      setIsBuffering(false);
    };
    const onError = () => {
      if (geoRestricted) {
        setIsLoading(false);
        return;
      }
      if (keepRunningPlaybackOnIssue()) return;
      setHasError(true);
      setIsLoading(false);
    };
    const onProgress = () => {
      if (!video.buffered.length) return;
      const end = video.buffered.end(video.buffered.length - 1);
      const dur = video.duration;
      if (dur > 0 && Number.isFinite(dur)) setBufferedPct(Math.min(100, (end / dur) * 100));
      else setBufferedPct(0);
    };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      const dur = video.duration;
      setDuration(Number.isFinite(dur) ? dur : 0);
    };
    const onDurationChange = () => {
      const dur = video.duration;
      setDuration(Number.isFinite(dur) ? dur : 0);
    };
    const onEnterPiP = () => setPipActive(true);
    const onLeavePiP = () => setPipActive(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", onError);
    video.addEventListener("progress", onProgress);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("enterpictureinpicture", onEnterPiP);
    video.addEventListener("leavepictureinpicture", onLeavePiP);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("enterpictureinpicture", onEnterPiP);
      video.removeEventListener("leavepictureinpicture", onLeavePiP);
    };
  }, [clearHideTimer, scheduleHideControls, allUrlsList, urlIdx, scheduleRetryKey, geoRestricted, keepRunningPlaybackOnIssue, clearRunningIssueTimer]);

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
    let touchStartScale = 1;
    let initialPinchDist = 0;
    let isSwiping = false;

    function showVolOverlay(vol: number) {
      if (volFeedbackTimerRef.current) clearTimeout(volFeedbackTimerRef.current);
      setVolFeedback(Math.round(vol * 100));
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
      isSwiping = false;

      const now = Date.now();
      const tapX = touch.clientX - rect.left;
      if (now - lastTapTime < 320 && Math.abs(tapX - lastTapX) < rect.width * 0.6) {
        lastTapTime = 0;
        void (async () => {
          const el = containerRef.current;
          if (!el) return;
          if (document.fullscreenElement) await document.exitFullscreen();
          else await el.requestFullscreen();
        })();
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
      if (touchStartX < rect.width / 2) return;
      const delta = deltaY / rect.height;
      const newVol = Math.min(1, Math.max(0, touchStartVol + delta));
      video!.volume = newVol;
      video!.muted = newVol === 0;
      setVolumeState(newVol);
      setIsMuted(newVol === 0);
      showVolOverlay(newVol);
    }

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
    };
  }, [videoScale, brightnessPct]);

  /** Sync orientation when fullscreen is toggled via browser (e.g. ESC) or gesture. */
  useEffect(() => {
    if (!isMobileSheet) return;
    if (isFullscreen) {
      void tryLockLandscapePlayback();
    } else if (!isTheaterMode) {
      tryUnlockPlaybackOrientation();
    }
  }, [isMobileSheet, isFullscreen, isTheaterMode]);

  useEffect(
    () => () => {
      tryUnlockPlaybackOrientation();
      clearHideTimer();
      if (retryPendingRef.current) clearTimeout(retryPendingRef.current);
      if (stablePlaybackTimerRef.current) clearTimeout(stablePlaybackTimerRef.current);
      clearRunningIssueTimer();
      healthTrackerRef.current?.destroy();
      healthTrackerRef.current = null;
      const hls = hlsRef.current;
      if (hls) {
        try {
          hls.stopLoad();
          hls.detachMedia();
          hls.destroy();
        } catch {
          /* */
        }
      }
      hlsRef.current = null;
    },
    [clearHideTimer, clearRunningIssueTimer]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (showExternalPanel) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [showExternalPanel]);

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
    const hls = hlsRef.current;
    if (!hls) {
      setSelectedQuality(level);
      return;
    }
    if (level === -1) {
      hls.currentLevel = -1;
      setSelectedQuality(-1);
      return;
    }
    let bestIdx = -1;
    let bestHeight = 0;
    hls.levels.forEach((lv, idx) => {
      const h = lv.height ?? 0;
      if (h <= level && h >= bestHeight) {
        bestHeight = h;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0) {
      hls.currentLevel = bestIdx;
      setSelectedQuality(bestIdx);
      if (hls.levels[bestIdx]?.height) setStreamResolution(`${hls.levels[bestIdx]!.height}p`);
    } else {
      setSelectedQuality(level);
    }
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
    clearRunningIssueTimer();
    setHasError(false);
    setNeedsUserGesture(false);
    setGeoRestricted(false);
    setIsLoading(true);
    setIsBuffering(false);
    setEverPlayed(false);
    setAutoRetryCountdown(0);
    playbackStartedRef.current = false;
    everPlayedRef.current = false;
    linkRetryRef.current = 0;
    hlsRecoveryRef.current = 0;
    serverWakeRetryRef.current = 0;
    stallCountRef.current = 0;
    urlPlayIndexRef.current = 0;
    setUrlIdx(0);
    setRetryKey((k) => k + 1);
  }, [clearRunningIssueTimer]);

  useEffect(() => {
    onStreamErrorRef.current = onStreamError;
  }, [onStreamError]);

  const retryStreamManual = useCallback(() => {
    autoRetryCountRef.current = 0;
    retryStream();
  }, [retryStream]);

  // Auto-retry countdown: only before first successful playback (never interrupt active viewing)
  useEffect(() => {
    if (!hasError && !geoRestricted) { setAutoRetryCountdown(0); return; }
    if (geoRestricted) {
      setAutoRetryCountdown(0);
      return;
    }
    if (everPlayedRef.current || playbackStartedRef.current) {
      setAutoRetryCountdown(0);
      return;
    }
    if (autoRetryCountRef.current >= MAX_AUTO_RETRIES) {
      setAutoRetryCountdown(0);
      return;
    }
    onStreamErrorRef.current?.();
    const secs = autoRetryCountRef.current < 2 ? 12 : 20;
    setAutoRetryCountdown(secs);
    const interval = setInterval(() => {
      setAutoRetryCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          autoRetryCountRef.current += 1;
          retryStream();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [hasError, geoRestricted, retryStream, onStreamError]);

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

  const selectedQualityForPanel = useMemo(() => {
    if (selectedQuality === -1) return -1;
    const opt = qualityOptions.find((o) => o.value === selectedQuality);
    if (!opt) return selectedQuality;
    const m = opt.label.match(/(\d{3,4})p/i);
    return m ? Number(m[1]) : selectedQuality;
  }, [selectedQuality, qualityOptions]);

  const programTitle = useMemo(() => {
    const match = liveMatchTitle?.trim();
    if (match) return match;
    const epg = epgProgramTitle?.trim();
    if (epg) return epg;
    const channel = title?.trim();
    if (channel) return channel;
    return "Live Broadcast";
  }, [liveMatchTitle, epgProgramTitle, title]);

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const showErrorOverlay = hasError || geoRestricted;

  const setVolumeFromPct = useCallback(
    (pct: number) => setVolumeLevel(pct / 100),
    [setVolumeLevel]
  );

  const setBrightnessFromPct = useCallback((pct: number) => {
    setBrightnessPct(Math.min(100, Math.max(10, pct)));
  }, []);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handlePlaybackSpeedChange = useCallback((speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
  }, []);

  const handleLowLatencyToggle = useCallback((enabled: boolean) => {
    setLowLatencyMode(enabled);
    setRetryKey((k) => k + 1);
  }, []);

  const syncMediaTracks = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const audio: AudioTrackOption[] = [];
    const hlsAudio = (hlsRef.current as HlsAudioTrackList | null)?.audioTracks ?? [];
    if (hlsAudio.length > 0) {
      hlsAudio.forEach((track, idx) => {
        audio.push({
          id: `hls:${idx}`,
          label: track.name || track.lang || track.groupId || `Audio ${idx + 1}`,
        });
      });
    }
    const vAudio = (video as HTMLVideoElement & { audioTracks?: NativeAudioTrackList }).audioTracks;
    if (audio.length === 0 && vAudio?.length) {
      for (let i = 0; i < vAudio.length; i++) {
        const t = vAudio[i];
        if (t) audio.push({ id: `native:${t.id || i}`, label: t.label || `Audio ${i + 1}` });
      }
    }
    if (audio.length === 0) {
      audio.push({ id: "default", label: "Default" });
    }
    setAudioTracks(audio);
    setSelectedAudioTrack((prev) => {
      if (audio.some((track) => track.id === prev)) return prev;
      const hlsTrack = hlsRef.current as HlsAudioTrackList | null;
      const activeHls = typeof hlsTrack?.audioTrack === "number" ? `hls:${hlsTrack.audioTrack}` : null;
      if (activeHls && audio.some((track) => track.id === activeHls)) return activeHls;
      const activeNative = vAudio
        ? audio.find((track) => {
            if (!track.id.startsWith("native:")) return false;
            for (let i = 0; i < vAudio.length; i++) {
              const t = vAudio[i];
              if (t?.enabled && track.id === `native:${t.id || i}`) return true;
            }
            return false;
          })?.id
        : null;
      return activeNative ?? audio[0]?.id ?? "default";
    });

    const subs: SubtitleTrackOption[] = [];
    for (let i = 0; i < video.textTracks.length; i++) {
      const t = video.textTracks[i];
      if (t && (t.kind === "subtitles" || t.kind === "captions")) {
        subs.push({ id: t.id || String(i), label: t.label || `Subtitle ${i + 1}` });
      }
    }
    setSubtitleTracks(subs);
  }, []);

  const handleAudioTrackChange = useCallback((id: string) => {
    const hls = hlsRef.current as HlsAudioTrackList | null;
    if (id.startsWith("hls:") && hls) {
      const next = Number(id.slice(4));
      if (Number.isInteger(next)) hls.audioTrack = next;
      setSelectedAudioTrack(id);
      return;
    }

    const video = videoRef.current as (HTMLVideoElement & { audioTracks?: NativeAudioTrackList }) | null;
    const vAudio = video?.audioTracks;
    if (id.startsWith("native:") && vAudio?.length) {
      for (let i = 0; i < vAudio.length; i++) {
        const track = vAudio[i];
        if (track) track.enabled = id === `native:${track.id || i}`;
      }
    }
    setSelectedAudioTrack(id);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onMeta = () => syncMediaTracks();
    video.addEventListener("loadedmetadata", onMeta);
    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, [syncMediaTracks, streamIdentity]);

  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls) return;
    const onAudioTracksUpdated = () => syncMediaTracks();
    const onAudioTrackSwitched = (_event: unknown, data: { id?: number }) => {
      if (typeof data.id === "number") setSelectedAudioTrack(`hls:${data.id}`);
    };
    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, onAudioTracksUpdated);
    hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, onAudioTrackSwitched);
    syncMediaTracks();
    return () => {
      hls.off(Hls.Events.AUDIO_TRACKS_UPDATED, onAudioTracksUpdated);
      hls.off(Hls.Events.AUDIO_TRACK_SWITCHED, onAudioTrackSwitched);
    };
  }, [syncMediaTracks, streamIdentity, retryKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    for (let i = 0; i < video.textTracks.length; i++) {
      const t = video.textTracks[i];
      if (!t) continue;
      t.mode = selectedSubtitle !== "off" && t.id === selectedSubtitle ? "showing" : "hidden";
    }
  }, [selectedSubtitle, streamIdentity]);

  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls) return;
    const level = hls.levels[hls.currentLevel];
    if (level?.height) setStreamResolution(`${level.height}p`);
    if (level?.codecSet) setStreamCodec(level.codecSet.split(",")[0] ?? "HLS");
  }, [selectedQuality, streamIdentity]);

  const handleVideoSurfaceClick = useCallback(
    (e: React.MouseEvent) => {
      const now = Date.now();
      if (now - lastTapRef.current < 320) {
        lastTapRef.current = 0;
        e.preventDefault();
        void toggleFullscreen();
        return;
      }
      lastTapRef.current = now;
      if (needsUserGesture) {
        void attemptVideoPlayback();
      }
      showControlsTemporarily();
    },
    [toggleFullscreen, showControlsTemporarily, needsUserGesture, attemptVideoPlayback]
  );

  const castAvailable =
    typeof window !== "undefined" &&
    Boolean((window as Window & { chrome?: { cast?: unknown } }).chrome?.cast);

  const reportStreamIssue = useCallback(() => {
    const subject = encodeURIComponent(`ABO Sports TV — Stream issue: ${programTitle}`);
    const body = encodeURIComponent(
      `Channel: ${title}\nProgram: ${programTitle}\nMirror: ${urlIdx + 1}/${allUrlsList.length}\nQuality: ${currentQualityLabel}\nBitrate: ${streamBitrate}\n`
    );
    window.open(`mailto:support@abosportstv.com?subject=${subject}&body=${body}`, "_blank");
  }, [programTitle, title, urlIdx, allUrlsList.length, currentQualityLabel, streamBitrate]);

  const openExternalPlayerFromSettings = useCallback(() => {
    setShowSettingsPanel(false);
    setShowExternalPanel(true);
  }, []);

  const handlePlayerPointerLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return;
      const next = e.relatedTarget;
      if (next instanceof Node && e.currentTarget.contains(next)) return;
      if (isPlaying) setShowControls(false);
    },
    [isPlaying]
  );

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
          filter: brightnessPct < 100 ? `brightness(${brightnessPctToFilter(brightnessPct)})` : undefined,
        }}
        autoPlay
        playsInline
        controls={false}
        preload={isMobilePlayer ? "metadata" : "auto"}
      />

      {brightnessPct < 100 ? (
        <div
          className="pointer-events-none absolute inset-0 z-[8]"
          style={{ background: `rgba(0,0,0,${brightnessPctToDimOpacity(brightnessPct)})` }}
          aria-hidden
        />
      ) : null}

      <div
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={handleVideoSurfaceClick}
        onMouseMove={showControlsTemporarily}
        aria-hidden
      />


      {/* ── Loading / Switching — Premium branded screen ── */}
      <AnimatePresence>
        {(isSwitching || (isLoading && !playbackStartedRef.current)) && !everPlayed && !showErrorOverlay && (
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
              {/* Logo — always ABO Sports TV brand */}
              <div
                className="relative flex h-[56px] w-[56px] items-center justify-center rounded-full overflow-hidden"
                style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,166,35,0.15)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={DEFAULT_PLAYER_BRAND_LOGO}
                  alt="ABO Sports TV"
                  className="h-[52px] w-[52px] object-contain"
                />
              </div>
            </div>

            {/* Text */}
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-[13px] font-bold tracking-wide text-white truncate max-w-[200px] text-center" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
                {title || "ABO SPORTS TV"}
              </p>
              <p className="text-[11px] font-medium tracking-[0.08em]" style={{ color: "rgba(245,166,35,0.75)" }}>
                {serverWaking ? "Server জাগছে… একটু অপেক্ষা করুন" : LOADING_MSG}
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

      {/* Browser autoplay policies can require a user gesture, especially on iOS/mobile data. */}
      <AnimatePresence>
        {needsUserGesture && !showErrorOverlay && (
          <motion.div
            key="tap-to-play"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-30 flex items-center justify-center p-6"
            style={{ background: "linear-gradient(160deg, rgba(5,6,12,0.72), rgba(12,10,22,0.78))" }}
          >
            <button
              type="button"
              onClick={() => void attemptVideoPlayback()}
              className="flex flex-col items-center gap-3 rounded-2xl px-6 py-5 text-center transition active:scale-95"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(245,166,35,0.35)",
                color: "var(--text-main)",
                backdropFilter: "blur(12px)",
              }}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-gold text-xl font-black text-black">
                ▶
              </span>
              <span className="text-sm font-bold">Tap to play</span>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                মোবাইল ব্রাউজারে প্লে শুরু করতে একবার ট্যাপ করুন
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Buffering — compact branded indicator during rebuffer ── */}
      <AnimatePresence>
        {isBuffering && playbackStartedRef.current && !showErrorOverlay && (
          <motion.div
            key="buffering"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute inset-0 z-25 flex items-center justify-center"
          >
            <div
              className="flex flex-col items-center gap-2 rounded-2xl px-5 py-4"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={DEFAULT_PLAYER_BRAND_LOGO} alt="" className="h-10 w-10 object-contain animate-pulse" />
              <Loader2 size={16} className="animate-spin text-amber-400" aria-hidden />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error / Geo-restricted overlay ── */}
      <AnimatePresence>
        {showErrorOverlay && (
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
                  ? <>{geoRestricted ? "এই চ্যানেলটি আপনার অঞ্চলে সীমাবদ্ধ।" : "এই চ্যানেলটি কিছু অঞ্চলে সীমাবদ্ধ হতে পারে।"}<br />
                    <span style={{ color: "rgba(167,139,250,0.8)" }}>Player proxy ও direct fallback চেষ্টা করেছে। VPN (India/BD) অথবা External Player ব্যবহার করুন।</span></>
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
              <button type="button" onClick={retryStreamManual}
                className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-white transition active:scale-95"
                style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.25), rgba(245,166,35,0.15))", border: "1px solid rgba(245,166,35,0.45)", boxShadow: "0 4px 12px rgba(245,166,35,0.15)" }}>
                <RefreshCw size={13} /> আবার চেষ্টা
              </button>
              <button type="button" onClick={() => window.open(externalPlaybackUrl || sharePlaybackUrl, "_blank", "noopener,noreferrer")}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition hover:bg-white/10 active:scale-95"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}>
                <ExternalLink size={13} /> Tab-এ খুলুন
              </button>
              <button type="button" onClick={() => setShowExternalPanel(true)}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition hover:bg-white/10 active:scale-95"
                style={{ background: "rgba(99,102,241,0.14)", border: "1px solid rgba(129,140,248,0.35)", color: "rgba(199,210,254,0.95)" }}>
                <ExternalLink size={13} /> External Player
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Custom overlay slot — reserved for non-obstructive UI; match metadata removed */}
      {overlay ? <div className="pointer-events-none absolute inset-x-0 bottom-16 z-30 hidden">{overlay}</div> : null}

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
              Tap for controls · Double-tap fullscreen
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showControls ? (
          <PlayerControlBar
            key="controls"
            isPlaying={isPlaying}
            isMuted={isMuted}
            volume={volume}
            isFullscreen={isFullscreen}
            settingsOpen={showSettingsPanel}
            isLive={isLive}
            currentTime={currentTime}
            duration={duration}
            bufferedPct={bufferedPct}
            VolumeIcon={VolumeIcon}
            onTogglePlay={() => void togglePlayPause()}
            onVolumeChange={setVolumeFromPct}
            onOpenSettings={() => setShowSettingsPanel(true)}
            onToggleFullscreen={() => void toggleFullscreen()}
            onSeek={isLive ? undefined : handleSeek}
          />
        ) : null}
      </AnimatePresence>

      {typeof document !== "undefined" && showExternalPanel
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${externalPanelTitleId}-ext-title`}
              className="fixed inset-0 z-[200] flex flex-col justify-end sm:items-center sm:justify-center sm:p-4"
            >
              <button
                type="button"
                className="absolute inset-0 z-0 border-0 bg-black/70 backdrop-blur-sm"
                aria-label="Close player picker"
                onClick={() => setShowExternalPanel(false)}
              />
              <div
                className="relative z-10 max-h-[min(70dvh,32rem)] w-full max-w-md overflow-hidden rounded-t-2xl border border-white/10 bg-[#080910] shadow-2xl sm:rounded-2xl"
                style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
              >
                <div className="flex justify-center pt-2" aria-hidden>
                  <div className="h-1 w-10 rounded-full bg-white/20" />
                </div>
                <div className="max-h-[min(65dvh,30rem)] overflow-y-auto overflow-x-hidden px-3 pt-1 pb-1">
                  <ExternalPlayerPicker
                    idPrefix={externalPanelTitleId}
                    streamUrl={externalPlaybackUrl}
                    onClose={() => setShowExternalPanel(false)}
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      <PlayerSettingsPanel
        open={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        isMobile={isMobileSheet}
        selectedQuality={selectedQualityForPanel}
        qualityOptions={qualityOptions}
        onQualityChange={changeQuality}
        audioTracks={audioTracks}
        selectedAudioTrack={selectedAudioTrack}
        onAudioTrackChange={handleAudioTrackChange}
        subtitleTracks={subtitleTracks}
        selectedSubtitle={selectedSubtitle}
        onSubtitleChange={setSelectedSubtitle}
        playbackSpeed={playbackSpeed}
        onPlaybackSpeedChange={handlePlaybackSpeedChange}
        castAvailable={castAvailable}
        pipEnabled={typeof document !== "undefined" && document.pictureInPictureEnabled}
        pipActive={pipActive}
        onTogglePictureInPicture={() => void togglePictureInPicture()}
        onReloadStream={retryStream}
        onOpenExternalPlayer={openExternalPlayerFromSettings}
        lowLatencyMode={lowLatencyMode}
        onLowLatencyModeChange={handleLowLatencyToggle}
        streamInfo={{
          resolution: streamResolution,
          codec: streamCodec,
          bitrate: streamBitrate,
          source: `Mirror ${urlIdx + 1}/${allUrlsList.length}`,
        }}
        onReportIssue={reportStreamIssue}
        brightness={brightnessPct}
        onBrightnessChange={setBrightnessFromPct}
      />
    </motion.div>
  );
}
