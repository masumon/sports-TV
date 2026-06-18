"use client";

import * as dashjs from "dashjs";
import Hls from "hls.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Globe,
  Loader2,
  Lock,
  Maximize,
  Minimize,
  Moon,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  Settings,
  Share2,
  SkipBack,
  SkipForward,
  Tv,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { ExternalPlayerPicker } from "@/components/player/ExternalPlayerPicker";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  buildProxyM3U8RequestUrl,
  buildProxyStreamUrl,
  isDashProxiedStreamUrl,
  isNativeVideoProxiedUrl,
  parseDynamicM3U8IdFromStreamUrl,
} from "@/lib/streamRelay";
import { trackEvent } from "@/lib/analytics";

/* ─────────────────────────────────────────────────────────── Types ── */
type QualityOption = { label: string; value: number };

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
  /** Called when user taps the back/close button in the player top bar. */
  onBack?: () => void;
  /** Numeric channel ID — used to generate a valid shareable deep-link URL. */
  channelId?: number;
  /** Hint that this is a live stream (used by callers; currently informational). */
  isLive?: boolean;
};

/** Matches `TopBar` / `Sidebar` — always shown on the player when channel has no logo. */
const DEFAULT_PLAYER_BRAND_LOGO = "/icons/abo-sports-tv-logo.png";

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
  lock?: (orientation: "landscape" | "landscape-primary") => Promise<void>;
};

async function tryLockLandscape(): Promise<void> {
  if (typeof screen === "undefined") return;
  const o = screen.orientation as ScreenOrientationWithLock | null;
  if (!o?.lock) return;
  try { await o.lock("landscape"); } catch {
    try { await o.lock("landscape-primary"); } catch { /* iOS / not fullscreen */ }
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
const QUALITY_PREF_KEY = "gstv-quality-height";
const HIDE_CONTROLS_AFTER_MS = 4500;
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
const LINK_RETRY_DELAY_MS = 1200;
const URL_FAIL_COOLDOWN_MS = 2 * 60 * 1000; // 2min cooldown (was 5min — too long for transient errors)
const recentlyFailedUrlUntil = new Map<string, number>();

const HLS_MANIFEST_LOAD_TIMEOUT_MS = 20_000;
const HLS_LEVEL_LOAD_TIMEOUT_MS = 18_000;
const HLS_FRAG_LOAD_TIMEOUT_MS = 20_000;

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

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
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
  onBack,
  channelId,
}: PremiumPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<ReturnType<ReturnType<typeof dashjs.MediaPlayer>["create"]> | null>(null);
  /** After first `playing`, do not show the full-screen loader on routine rebuffering. */
  const playbackStartedRef = useRef(false);
  const successTrackedRef = useRef(false);
  const errorTypeRef = useRef<string>("unknown");

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(() => {
    try { const v = parseFloat(localStorage.getItem("gstv-vol") ?? "1"); return isNaN(v) ? 1 : Math.max(0, Math.min(1, v)); } catch { return 1; }
  });
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

  /** Premium OTT UI state */
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"video" | "audio" | "subtitle">("video");
  const [audioTracks, setAudioTracks] = useState<QualityOption[]>([]);
  const [selectedAudio, setSelectedAudio] = useState(0);
  const [subtitleTracks, setSubtitleTracks] = useState<{ label: string; value: number }[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState(-1);
  const [aspectRatio, setAspectRatio] = useState<"cover" | "contain">("cover");
  const [isLocked, setIsLocked] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const resolvedDirect = useMemo(() => {
    if (streamUrls?.length) {
      return streamUrls.filter((u) => typeof u === "string" && u.trim().startsWith("http"));
    }
    return [streamUrl, ...(alternateUrls ?? [])].filter((u) => u && u.trim().startsWith("http"));
  }, [streamUrls, streamUrl, alternateUrls]);

  // Only trigger remount if the primary URL (index 0) changes, not all URLs
  const streamIdentity = useMemo(() => resolvedDirect[0] ?? "", [resolvedDirect]);

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
  const isCurrentRelay = (allUrlsList[urlIdx] ?? "").includes("/proxy/stream");


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
    urlPlayIndexRef.current = 0;
    setUrlIdx(0);
    setIsSwitching(false);
    setGeoRestricted(false);
    linkRetryRef.current = 0;
    firstHideDoneRef.current = false;
    hintShownRef.current = false;
    successTrackedRef.current = false;
    errorTypeRef.current = "unknown";
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

    const allUrls = prioritizeHealthyUrls(buildOrderedStreamUrls(directUrls, dynamicM3U8Id, headerProfile));
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
    const isNativeVideo = !isDash && isNativeVideoProxiedUrl(effectiveUrl);

    const lightNet = isConstrainedNetwork();
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
          if (nextIdx > 1) toast.info("ব্যাকআপ সোর্সে সুইচ হচ্ছে…");
          /* dash.js typings omit in-place source swap; remount via retryKey like HLS destroy path */
          setRetryKey((k) => k + 1);
        } else {
          setIsSwitching(false);
          setHasError(true);
          setIsLoading(false);
          toast.error("সব স্ট্রিম অনুপলব্ধ — অন্য চ্যানেল বা এক্সটার্নাল প্লেয়ার চেষ্টা করুন");
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

    if (isNativeVideo) {
      // Direct video format (MP4, WebM, etc.) through proxy — use native <video> src
      video.src = effectiveUrl;
      setIsSwitching(false);
      void video.play().catch(() => {
        video.muted = true;
        void video.play().catch(() => {});
      });
    } else if (Hls.isSupported()) {
      let hlsInstance: Hls | null = null;
      let tryFailover: (message?: string) => boolean = () => false;
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: !lightNet,
        // Better buffer management: prevent excessive buffering + thrashing
        maxBufferLength: lightNet ? 10 : 20,
        maxMaxBufferLength: lightNet ? 20 : 40,
        maxBufferSize: lightNet ? 20 * 1000 * 1000 : 50 * 1000 * 1000,
        maxBufferHole: 0.3, // Tighter hole tolerance to detect stalls faster
        liveSyncDurationCount: lightNet ? 3 : 4,
        liveMaxLatencyDurationCount: lightNet ? 8 : 12,
        liveDurationInfinity: true,
        abrEwmaDefaultEstimate: lightNet ? 400_000 : 1_000_000,
        abrBandWidthFactor: lightNet ? 0.92 : 0.95,
        abrBandWidthUpFactor: lightNet ? 0.6 : 0.75,
        manifestLoadingTimeOut: HLS_MANIFEST_LOAD_TIMEOUT_MS,
        manifestLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: 1500,
        levelLoadingTimeOut: HLS_LEVEL_LOAD_TIMEOUT_MS,
        levelLoadingMaxRetry: 2,
        levelLoadingRetryDelay: 1500,
        fragLoadingTimeOut: HLS_FRAG_LOAD_TIMEOUT_MS,
        fragLoadingMaxRetry: 2, // Increased for network resilience
        fragLoadingRetryDelay: lightNet ? 800 : 600,
        startLevel: -1,
        capLevelToPlayerSize: true,
        testBandwidth: true, // Enable bandwidth estimation
        xhrSetup: (xhr, requestUrl) => {
          const nextUrl = relayHlsXhrUrlIfNeeded(requestUrl, dynamicM3U8Id, headerProfile);
          if (nextUrl !== requestUrl) {
            xhr.open("GET", nextUrl, true);
          }
          const onEnd = () => {
            xhr.removeEventListener("loadend", onEnd);
            if (xhr.status >= 500 || xhr.status === 429) {
              if (tryFailover("সোর্স সার্ভার এরর — ব্যাকআপে সুইচ হচ্ছে…")) return;
              setIsLoading(false);
              setIsSwitching(false);
              hlsInstance?.destroy();
              if (hlsRef.current === hlsInstance) hlsRef.current = null;
              return;
            }
            if (!parseGeoFromXhr(xhr)) return;
            if (tryFailover("জিও-ব্লক — ব্যাকআপ সোর্সে সুইচ হচ্ছে…")) {
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
      tryFailover = (message?: string): boolean => {
        const cur = urlPlayIndexRef.current;
        markUrlFailed(allUrls[cur] ?? "");
        const nextIdx = cur + 1;
        if (nextIdx >= allUrls.length || !hlsInstance) return false;
        urlPlayIndexRef.current = nextIdx;
        setUrlIdx(nextIdx);
        playbackStartedRef.current = false;
        setIsSwitching(true);
        setIsLoading(true);
        const nextU = allUrls[nextIdx] ?? "";
        if (nextIdx > 1) {
          toast.info(
            message ??
              (nextU.includes("/proxy/stream") && !(allUrls[cur] ?? "").includes("/proxy/stream")
                ? "সার্ভার রিলেতে সুইচ হচ্ছে…"
                : "স্ট্রিম অস্থির — ব্যাকআপ সোর্স চেষ্টা করছি…")
          );
        }
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
      if (bounded === 0) trackEvent("PLAYBACK_START", { channel_id: channelId, channel_name: title });

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal && data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
          trackEvent("BUFFER_STALL", { channel_id: channelId, channel_name: title });
          return;
        }
        if (!data.fatal) return;
        const resp = (data as { response?: { code?: number } }).response;
        const httpCode = resp?.code;

        if (httpCode === 403 || httpCode === 401) {
          if (tryFailover()) return;
          errorTypeRef.current = "geo_restricted";
          setGeoRestricted(true);
          setIsLoading(false);
          setIsSwitching(false);
          return;
        }

        const isNet = data.type === Hls.ErrorTypes.NETWORK_ERROR;
        const isManifest =
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR;
        const isFrag =
          data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.FRAG_PARSING_ERROR;

        // Only retry on manifest/fragment errors or during initial load, not routine network blips
        if ((isManifest || (isFrag && !playbackStartedRef.current)) && !isNet) {
          if (tryFailover()) return;
        }

        // Network errors during playback = skip retry, failover immediately
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && playbackStartedRef.current) {
          if (tryFailover()) return;
          errorTypeRef.current = "network";
          linkRetryRef.current = 0;
          setIsSwitching(false);
          setHasError(true);
          setIsLoading(false);
          toast.error("সব স্ট্রিম অনুপলব্ধ — অন্য চ্যানেল বা এক্সটার্নাল প্লেয়ার চেষ্টা করুন");
          return;
        }

        // Only retry network errors during initial manifest load (not during playback)
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !playbackStartedRef.current) {
          const retries = linkRetryRef.current;
          if (retries < LINK_RETRY_ATTEMPTS - 1) {
            linkRetryRef.current = retries + 1;
            setIsLoading(true);
            if (linkRetryTimerRef.current) clearTimeout(linkRetryTimerRef.current);
            linkRetryTimerRef.current = setTimeout(() => {
              linkRetryTimerRef.current = null;
              setRetryKey((k) => k + 1);
            }, LINK_RETRY_DELAY_MS);
            return;
          }
        }

        linkRetryRef.current = 0;
        if (tryFailover()) return;

        errorTypeRef.current = data.type === Hls.ErrorTypes.NETWORK_ERROR ? "network" : "unknown";
        setIsSwitching(false);
        setHasError(true);
        setIsLoading(false);
        toast.error("সব স্ট্রিম অনুপলব্ধ — অন্য চ্যানেল বা এক্সটার্নাল প্লেয়ার চেষ্টা করুন");
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        linkRetryRef.current = 0;
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
        if (!lightNet && parsed.length) {
          try {
            const savedH = parseInt(localStorage.getItem(QUALITY_PREF_KEY) ?? "", 10);
            if (savedH > 0) {
              const best = hls.levels.reduce((bi, lv, i) =>
                lv.height && Math.abs(lv.height - savedH) < Math.abs((hls.levels[bi]?.height ?? 0) - savedH) ? i : bi, 0);
              if (hls.levels[best]?.height) { hls.currentLevel = best; setSelectedQuality(best); }
            }
          } catch { /* */ }
        }
        if (hls.audioTracks.length > 1) {
          setAudioTracks(hls.audioTracks.map((t, i) => ({ label: t.name || `Track ${i + 1}`, value: i })));
          setSelectedAudio(hls.audioTrack);
        }
        if (hls.subtitleTracks.length > 0) {
          setSubtitleTracks([{ label: "Off", value: -1 }, ...hls.subtitleTracks.map((t, i) => ({ label: t.name || `Sub ${i + 1}`, value: i }))]);
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => setSelectedQuality(data.level));
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = effectiveUrl;
      setIsSwitching(false);
    }

    return cleanup;
  }, [streamIdentity, retryKey, directUrls, dynamicM3U8Id, headerProfile]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => { setIsPlaying(true); scheduleHideControls(); };
    const onPause = () => { setIsPlaying(false); setShowControls(true); clearHideTimer(); };
    const onVolumeChange = () => { setIsMuted(video.muted); setVolumeState(video.volume); };
    const onWaiting = () => {
      if (playbackStartedRef.current) return;
      setIsLoading(true);
    };
    const onPlaying = () => {
      if (!successTrackedRef.current) {
        successTrackedRef.current = true;
        trackEvent("PLAYBACK_SUCCESS", { channel_id: channelId, channel_name: title });
        if (urlPlayIndexRef.current > 0) {
          trackEvent("PLAYBACK_RETRY", { channel_id: channelId, channel_name: title, value: urlPlayIndexRef.current });
        }
      }
      playbackStartedRef.current = true;
      setIsLoading(false);
      setHasError(false);
    };
    const onCanPlay = () => setIsLoading(false);
    const onError = () => { setHasError(true); setIsLoading(false); };
    const onProgress = () => {
      if (!video.buffered.length) return;
      const end = video.buffered.end(video.buffered.length - 1);
      const dur = video.duration;
      if (dur > 0 && Number.isFinite(dur)) setBufferedPct(Math.min(100, (end / dur) * 100));
    };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (Number.isFinite(video.duration) && video.duration > 0) setDuration(video.duration);
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", onError);
    video.addEventListener("progress", onProgress);
    video.addEventListener("timeupdate", onTimeUpdate);
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
    };
  }, [clearHideTimer, scheduleHideControls]);

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
    let touchStartVol = 1;
    let isSwiping = false;

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

    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      if (!touch) return;
      touchStartY = touch.clientY;
      touchStartVol = video!.volume;
      isSwiping = false;

      const now = Date.now();
      const rect = container!.getBoundingClientRect();
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
      const touch = e.touches[0];
      if (!touch) return;
      const deltaY = touchStartY - touch.clientY;
      if (!isSwiping && Math.abs(deltaY) < 20) return;
      isSwiping = true;
      const rect = container!.getBoundingClientRect();
      const volDelta = deltaY / rect.height;
      const newVol = Math.min(1, Math.max(0, touchStartVol + volDelta));
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
  }, []);

  /** Fullscreen → lock landscape. Exit fullscreen → unlock. Theater mode never locks. */
  useEffect(() => {
    if (!isMobileSheet) return;
    if (isFullscreen) void tryLockLandscape();
    else tryUnlockPlaybackOrientation();
  }, [isMobileSheet, isFullscreen]);

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
      // Cleanup HLS instance completely
      if (hlsRef.current) {
        try {
          hlsRef.current.stopLoad?.();
          hlsRef.current.detachMedia?.();
          hlsRef.current.destroy?.();
        } catch {
          /* */
        }
        hlsRef.current = null;
      }
      // Cleanup DASH instance
      if (dashRef.current) {
        try {
          dashRef.current.reset?.();
        } catch {
          /* */
        }
        dashRef.current = null;
      }
      // Clear video source to prevent dangling connections
      const video = videoRef.current;
      if (video) {
        video.src = "";
        try {
          video.pause?.();
        } catch {
          /* */
        }
      }
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
    try { localStorage.setItem("gstv-vol", String(clamped)); } catch { /* */ }
  }, []);

  const changeQuality = useCallback((level: number) => {
    setSelectedQuality(level);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      try {
        if (level === -1) localStorage.removeItem(QUALITY_PREF_KEY);
        else {
          const h = hlsRef.current.levels[level]?.height;
          if (h) localStorage.setItem(QUALITY_PREF_KEY, String(h));
        }
      } catch { /* */ }
    }
    trackEvent("QUALITY_CHANGE", { channel_id: channelId, channel_name: title, value: level });
  }, [channelId, title]);

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
      if (isMobileSheet) await tryLockLandscape();
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

  const seekBy = useCallback((secs: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime + secs);
  }, []);

  const toggleAspectRatio = useCallback(() => {
    setAspectRatio((v) => (v === "cover" ? "contain" : "cover"));
  }, []);

  const shareChannel = useCallback(async () => {
    const url = channelId && channelId > 0
      ? `${window.location.origin}/?channel_id=${channelId}`
      : window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); toast.success("লিঙ্ক কপি হয়েছে!"); }
    } catch { /* */ }
  }, [title, channelId]);

  const changeAudio = useCallback((idx: number) => {
    if (hlsRef.current) hlsRef.current.audioTrack = idx;
    setSelectedAudio(idx);
  }, []);

  const changeSubtitle = useCallback((idx: number) => {
    if (hlsRef.current) hlsRef.current.subtitleTrack = idx;
    setSelectedSubtitle(idx);
  }, []);

  const switchServer = useCallback((idx: number) => {
    urlPlayIndexRef.current = idx;
    setUrlIdx(idx);
    setRetryKey((k) => k + 1);
    trackEvent("SERVER_SWITCH", { channel_id: channelId, channel_name: title, value: idx });
  }, [channelId, title]);

  // Cleanup sleep timer on unmount
  useEffect(() => () => { if (sleepTimerRef.current) clearInterval(sleepTimerRef.current); }, []);

  // Auto-retry countdown: when error or geo-block appears, count down then auto-retry
  useEffect(() => {
    if (!hasError && !geoRestricted) { setAutoRetryCountdown(0); return; }
    onStreamError?.();
    trackEvent(hasError ? "PLAYBACK_FAIL" : "PLAYER_ERROR", { channel_id: channelId, channel_name: title, meta: geoRestricted ? "geo_restricted" : errorTypeRef.current });
    const secs = geoRestricted ? 15 : 10;
    setAutoRetryCountdown(secs);
    const interval = setInterval(() => {
      setAutoRetryCountdown((c) => {
        if (c <= 1) { clearInterval(interval); retryStream(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [hasError, geoRestricted, retryStream, onStreamError, channelId, title]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") return;
      switch (e.code) {
        case "Space": e.preventDefault(); void togglePlayPause(); break;
        case "KeyM": toggleMute(); break;
        case "KeyF": void toggleFullscreen(); break;
        case "KeyT":
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
        className={`h-full w-full bg-black ${aspectRatio === "contain" || (isMobileSheet && (isFullscreen || isTheaterMode)) ? "object-contain" : "object-cover"}`}
        autoPlay
        playsInline
        controls={false}
        preload="metadata"
      />

      {/* Click-to-play */}
      <div className="absolute inset-0 z-10 cursor-pointer" onClick={() => void togglePlayPause()} />


      {/* ── Loading / Switching — Minimal OTT overlay (video stays visible) ── */}
      <AnimatePresence>
        {(isSwitching || (isLoading && !playbackStartedRef.current)) && !hasError && !geoRestricted && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
            className="absolute inset-0 z-30 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
          >
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={36} className="animate-spin" style={{ color: "#F5A623" }} />
              <p className="text-[11px] font-semibold tracking-wide" style={{ color: "rgba(255,255,255,0.65)" }}>
                {isSwitching
                  ? (isCurrentRelay ? "সার্ভার রিলে সংযোগ…" : "ব্যাকআপ চ্যানেলে যাচ্ছে…")
                  : "লাইভ সংযোগ হচ্ছে…"}
              </p>
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
            className="glass-loading-backdrop absolute inset-0 z-30 flex items-center justify-center p-6"
          >
            <div className={`${geoRestricted ? 'glass-error-panel-geo' : 'glass-error-panel'} flex flex-col items-center gap-5 p-8 w-full max-w-xs`}>
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
                {geoRestricted ? "লোকেশন সীমাবদ্ধতা" : "স্ট্রিম পাওয়া যাচ্ছে না"}
              </p>
              <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                {geoRestricted || geoHint
                  ? <>এই চ্যানেলটি আপনার দেশে সরাসরি চলে না।<br />
                    <span style={{ color: "rgba(167,139,250,0.8)" }}>VPN চালু করে India সার্ভার বেছে নিন।</span></>
                  : isConstrainedNetwork()
                  ? <>নেটওয়ার্ক সংযোগ দুর্বল।<br />WiFi বা ভালো 4G-তে চেষ্টা করুন।</>
                  : <>চ্যানেলটি এখন offline বা source পরিবর্তন হয়েছে।<br />একটু পরে আবার চেষ্টা করুন।</>}
              </p>
              {autoRetryCountdown > 0 && (
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  <Loader2 size={11} className="animate-spin" style={{ color: "var(--primary-accent)" }} />
                  <p className="text-[11px] font-semibold" style={{ color: "var(--primary-accent)" }}>
                    {autoRetryCountdown}s পরে স্বয়ংক্রিয়ভাবে চেষ্টা হবে…
                  </p>
                </div>
              )}
            </div>
            {/* Actions */}
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={retryStream}
                className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition active:scale-95"
                style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.35), rgba(245,166,35,0.2))", border: "1.5px solid rgba(245,166,35,0.6)", boxShadow: "0 4px 16px rgba(245,166,35,0.25)" }}>
                <RefreshCw size={15} /> আবার চেষ্টা
              </button>
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* LIVE badge — shown only when controls are hidden */}
      <div
        className={`pointer-events-none absolute left-3 z-30 transition-opacity duration-300 ${showControls ? "opacity-0" : "opacity-100"}`}
        style={{ top: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
      >
        <span
          className="glass-live-badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white"
        >
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-white" />
          LIVE
        </span>
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
                className="glass-seek-pill flex h-16 w-16 items-center justify-center"
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
            className="pointer-events-none absolute left-1/2 top-1/2 z-35 -translate-x-1/2 -translate-y-1/2"
          >
            <div
              className="glass-feedback-card flex flex-col items-center gap-2 px-6 py-4"
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
              স্পর্শ করুন · ডাবল ট্যাপ ±10s · উপরে/নিচে ভলিউম
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Rebuffering indicator (during playback) ── */}
      <AnimatePresence>
        {playbackStartedRef.current && isLoading && !hasError && (
          <motion.div
            key="rebuffer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute left-1/2 top-1/2 z-35 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="flex flex-col items-center gap-2">
              <motion.div
                className="flex h-12 w-12 items-center justify-center"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                <Loader2 size={24} className="animate-spin" style={{ color: "#F5A623" }} />
              </motion.div>
              <span className="text-[10px] font-semibold" style={{ color: "rgba(245,166,35,0.8)" }}>বাফারিং...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Premium OTT Controls — 4-zone layout ── */}
      <AnimatePresence>
        {showControls && !isLocked && (
          <motion.div
            key="controls"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-40 flex flex-col pointer-events-none"
          >
            {/* Top gradient */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)" }} />
            {/* Bottom gradient */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)" }} />

            {/* ── TOP BAR ── */}
            <div
              className="relative z-10 flex items-center gap-1.5 px-3 pointer-events-auto sm:gap-2"
              style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 0px))" }}
            >
              {onBack && (
                <button type="button" onClick={onBack} aria-label="Back" className="player-control-btn shrink-0">
                  <ArrowLeft size={17} />
                </button>
              )}
              {/* Channel badge */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={channelLogoUrl || DEFAULT_PLAYER_BRAND_LOGO}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-md object-contain bg-white p-0.5"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_PLAYER_BRAND_LOGO; }}
                />
                <div className="min-w-0 flex flex-col gap-1">
                  <p className="truncate text-xs font-bold leading-tight text-white sm:text-sm">{title}</p>
                  <div className="flex items-center gap-1.5">
                    {/* Match badge pill */}
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                      style={{ background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171" }}
                    >
                      <span className="h-1 w-1 animate-pulse rounded-full bg-red-400" />
                      LIVE
                    </span>
                    {isCurrentRelay && (
                      <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "rgba(0,229,255,0.12)", color: "#00E5FF", border: "1px solid rgba(0,229,255,0.3)" }}>RELAY</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Lock */}
              <button type="button" onClick={() => setIsLocked(true)} aria-label="Lock controls" className="player-control-btn shrink-0">
                <Lock size={15} />
              </button>
              {/* Aspect ratio — top bar visible on desktop only; mobile via Settings */}
              <button type="button" onClick={toggleAspectRatio} aria-label="Toggle aspect ratio" title="Aspect ratio" className="player-control-btn shrink-0 hidden sm:inline-flex">
                {aspectRatio === "contain" ? <Maximize size={15} /> : <Minimize size={15} />}
              </button>
              {/* Fullscreen */}
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className={`player-control-btn shrink-0${isFullscreen ? " player-control-btn-active" : ""}`}
              >
                {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
              </button>
              {/* Settings */}
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                aria-label="Settings"
                className={`player-control-btn shrink-0${showSettings ? " player-control-btn-active" : ""}`}
              >
                <Settings size={15} />
              </button>
            </div>

            {/* ── CENTER — Seek & Play ── */}
            <div className="relative z-10 flex flex-1 items-center justify-center gap-6 pointer-events-auto sm:gap-10">
              <button type="button" onClick={() => seekBy(-10)} aria-label="Seek back 10s" className="player-control-btn shrink-0 flex-col gap-0.5">
                <SkipBack size={19} />
                <span className="text-[9px] font-bold leading-none" style={{ color: "#00E5FF" }}>10</span>
              </button>
              <button
                type="button"
                onClick={() => void togglePlayPause()}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="flex shrink-0 items-center justify-center rounded-full transition active:scale-90"
                style={{
                  width: "3.5rem", height: "3.5rem",
                  background: "rgba(0,229,255,0.15)",
                  border: "2px solid rgba(0,229,255,0.65)",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 0 28px rgba(0,229,255,0.35)",
                }}
              >
                {isPlaying ? <Pause size={26} fill="white" color="white" /> : <Play size={26} fill="white" color="white" />}
              </button>
              <button type="button" onClick={() => seekBy(10)} aria-label="Seek forward 10s" className="player-control-btn shrink-0 flex-col gap-0.5">
                <SkipForward size={19} />
                <span className="text-[9px] font-bold leading-none" style={{ color: "#00E5FF" }}>10</span>
              </button>
            </div>

            {/* ── RIGHT SIDE — Volume + secondary actions ── */}
            <div
              className="absolute right-2 z-10 flex flex-col items-center gap-1.5 pointer-events-auto"
              style={{ top: "max(2.75rem, calc(env(safe-area-inset-top, 0px) + 2.75rem))" }}
            >
              {typeof document !== "undefined" && !!document.pictureInPictureEnabled && (
                <button type="button" onClick={() => void togglePictureInPicture()} aria-label="Picture-in-Picture"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl hidden sm:inline-flex"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)" }}>
                  <PictureInPicture2 size={13} />
                </button>
              )}
              <button type="button" onClick={() => void shareChannel()} aria-label="Share channel"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl hidden sm:inline-flex"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)" }}>
                <Share2 size={13} />
              </button>
              <button type="button" onClick={toggleMute} aria-label={isMuted ? "Unmute" : "Mute"}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)" }}>
                <VolumeIcon size={13} />
              </button>
              {!isTouchDevice && (
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolumeLevel(Number(e.target.value))}
                  aria-label="Volume"
                  className="volume-slider shrink-0"
                  style={{ writingMode: "vertical-lr", direction: "rtl", height: "60px", width: "4px", cursor: "pointer" }}
                />
              )}
              <button
                type="button"
                onClick={() => {
                  const opts = [15, 30, 60, 90];
                  if (!sleepMinutes) startSleepTimer(opts[0]!);
                  else {
                    const next = opts[opts.indexOf(sleepMinutes) + 1];
                    if (next) startSleepTimer(next); else cancelSleepTimer();
                  }
                }}
                className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl hidden min-[380px]:inline-flex`}
                style={{
                  background: sleepMinutes ? "rgba(245,166,35,0.18)" : "rgba(255,255,255,0.08)",
                  border: sleepMinutes ? "1px solid rgba(245,166,35,0.45)" : "1px solid rgba(255,255,255,0.12)",
                  color: sleepMinutes ? "#F5A623" : "rgba(255,255,255,0.75)",
                }}
                title={sleepMinutes ? `Sleep: ${Math.floor(sleepRemaining / 60)}:${String(sleepRemaining % 60).padStart(2, "0")}` : "Sleep timer"}
                aria-label="Sleep timer"
              >
                <Moon size={13} />
                {sleepMinutes && (
                  <span className="absolute -top-1 -right-0.5 rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black">
                    {Math.ceil(sleepRemaining / 60)}m
                  </span>
                )}
              </button>
            </div>

            {/* ── BOTTOM — Progress + Time ── */}
            <div
              className="relative z-10 px-3 pointer-events-auto"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
            >
              {/* Server chips */}
              {allUrlsList.length > 1 && (
                <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                  {allUrlsList.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => switchServer(i)}
                      className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold transition active:scale-95"
                      style={urlIdx === i ? {
                        background: "rgba(0,229,255,0.18)",
                        border: "1px solid rgba(0,229,255,0.55)",
                        color: "#00E5FF",
                        boxShadow: "0 0 8px rgba(0,229,255,0.25)",
                      } : {
                        background: "rgba(255,255,255,0.07)",
                        border: "1px solid rgba(255,255,255,0.14)",
                        color: "rgba(255,255,255,0.5)",
                      }}
                    >
                      S{i + 1}
                    </button>
                  ))}
                </div>
              )}

              {/* Progress bar */}
              <div
                className="mb-2 relative h-1.5 w-full cursor-pointer overflow-visible rounded-full"
                style={{ background: "rgba(255,255,255,0.12)" }}
                onClick={(e) => {
                  const video = videoRef.current;
                  if (!video || !video.duration || !Number.isFinite(video.duration)) return;
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  video.currentTime = ((e.clientX - rect.left) / rect.width) * video.duration;
                }}
              >
                {/* Buffer fill */}
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: "rgba(255,255,255,0.22)" }}
                  animate={{ width: `${bufferedPct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
                {/* Playback position (VOD only) */}
                {duration > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${(currentTime / duration) * 100}%`, background: "#00E5FF", boxShadow: "0 0 6px rgba(0,229,255,0.7)" }}
                  />
                )}
              </div>
              {/* Time labels */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold tabular-nums" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {duration > 0 ? formatTime(currentTime) : "00:00"}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider" style={{ color: "#00E5FF" }}>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "#ef4444" }} />
                  LIVE
                </span>
                <span className="text-[10px] font-semibold tabular-nums" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {duration > 0 ? formatTime(duration) : "--:--"}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Locked screen ── */}
      <AnimatePresence>
        {isLocked && (
          <motion.div
            key="locked"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-45 flex items-center justify-center"
            role="button"
            aria-label="Unlock controls"
            tabIndex={0}
            onClick={() => setIsLocked(false)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsLocked(false); }}
          >
            <div className="flex flex-col items-center gap-2 rounded-2xl px-5 py-3" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Lock size={22} style={{ color: "rgba(255,255,255,0.7)" }} />
              <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>ট্যাপ করুন আনলক করতে</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Settings panel ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.18 }}
            className="absolute right-3 z-50 w-48 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl shadow-2xl"
            style={{ top: "calc(max(4rem, env(safe-area-inset-top, 0px) + 2.75rem))", background: "rgba(6,7,14,0.94)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(24px)" }}
          >
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: "#00E5FF" }}>Settings</span>
              <button type="button" onClick={() => setShowSettings(false)} className="rounded p-0.5 text-white/40 transition hover:text-white">
                <X size={14} />
              </button>
            </div>
            {/* Tabs */}
            <div className="flex gap-1 px-3 pb-2">
              {(["video", "audio", "subtitle"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSettingsTab(tab)}
                  className="flex-1 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-wide transition"
                  style={{
                    background: settingsTab === tab ? "rgba(0,229,255,0.15)" : "rgba(255,255,255,0.05)",
                    color: settingsTab === tab ? "#00E5FF" : "rgba(255,255,255,0.4)",
                    border: settingsTab === tab ? "1px solid rgba(0,229,255,0.3)" : "1px solid transparent",
                  }}
                >
                  {tab === "video" ? "Video" : tab === "audio" ? "Audio" : "Sub"}
                </button>
              ))}
            </div>
            <div className="mx-3 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            {/* Content */}
            <div className="max-h-52 overflow-y-auto py-1">
              {settingsTab === "video" && (
                <>
                  {qualityOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => changeQuality(opt.value)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] font-semibold transition hover:bg-white/[0.07]"
                      style={{ color: selectedQuality === opt.value ? "#00E5FF" : "rgba(255,255,255,0.75)" }}
                    >
                      <span>{opt.label}</span>
                      {selectedQuality === opt.value && <Check size={12} style={{ color: "#00E5FF" }} />}
                    </button>
                  ))}
                  <div className="mx-3 my-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <button
                    type="button"
                    onClick={() => { onToggleTheaterMode(); setShowSettings(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-semibold transition hover:bg-white/[0.07]"
                    style={{ color: isTheaterMode ? "#00E5FF" : "rgba(255,255,255,0.65)" }}
                  >
                    <Tv size={13} />
                    <span>Theater Mode</span>
                    {isTheaterMode && <Check size={12} style={{ color: "#00E5FF" }} className="ml-auto" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { toggleAspectRatio(); setShowSettings(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-semibold transition hover:bg-white/[0.07] sm:hidden"
                    style={{ color: aspectRatio === "contain" ? "#00E5FF" : "rgba(255,255,255,0.65)" }}
                  >
                    {aspectRatio === "contain" ? <Maximize size={13} /> : <Minimize size={13} />}
                    <span>Aspect Ratio</span>
                    {aspectRatio === "contain" && <Check size={12} style={{ color: "#00E5FF" }} className="ml-auto" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowExternalPanel((v) => !v); setShowSettings(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-semibold transition hover:bg-white/[0.07]"
                    style={{ color: "rgba(255,255,255,0.65)" }}
                  >
                    <Tv size={13} />
                    <span>External Players</span>
                  </button>
                </>
              )}
              {settingsTab === "audio" && (
                audioTracks.length > 0
                  ? audioTracks.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => changeAudio(t.value)}
                        className="flex w-full items-center justify-between px-3 py-2 text-[12px] font-semibold transition hover:bg-white/[0.07]"
                        style={{ color: selectedAudio === t.value ? "#00E5FF" : "rgba(255,255,255,0.75)" }}
                      >
                        <span>{t.label}</span>
                        {selectedAudio === t.value && <Check size={12} style={{ color: "#00E5FF" }} />}
                      </button>
                    ))
                  : <p className="px-3 py-4 text-[11px] text-center" style={{ color: "rgba(255,255,255,0.3)" }}>অডিও ট্র্যাক নেই</p>
              )}
              {settingsTab === "subtitle" && (
                subtitleTracks.length > 0
                  ? subtitleTracks.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => changeSubtitle(t.value)}
                        className="flex w-full items-center justify-between px-3 py-2 text-[12px] font-semibold transition hover:bg-white/[0.07]"
                        style={{ color: selectedSubtitle === t.value ? "#00E5FF" : "rgba(255,255,255,0.75)" }}
                      >
                        <span>{t.label}</span>
                        {selectedSubtitle === t.value && <Check size={12} style={{ color: "#00E5FF" }} />}
                      </button>
                    ))
                  : <p className="px-3 py-4 text-[11px] text-center" style={{ color: "rgba(255,255,255,0.3)" }}>সাবটাইটেল নেই</p>
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
    </motion.div>
  );
}
