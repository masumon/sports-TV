import type { HlsConfig } from "hls.js";
import Hls from "hls.js";

export const HLS_MANIFEST_MAX_RETRY = 4;
export const HLS_LEVEL_MAX_RETRY = 3;
export const HLS_FRAG_MAX_RETRY = 3;
export const MAX_HLS_RECOVERY_ATTEMPTS = 6;
export const LINK_RETRY_ATTEMPTS = 4;

export const HLS_MANIFEST_LOAD_TIMEOUT_MS = 30000;
export const HLS_LEVEL_LOAD_TIMEOUT_MS = 25000;
export const HLS_FRAG_LOAD_TIMEOUT_MS = 30000;

type NetConn = { saveData?: boolean; effectiveType?: string };

export function isConstrainedNetwork(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as Navigator & { connection?: NetConn }).connection;
  if (!c) return false;
  if (c.saveData) return true;
  const t = c.effectiveType;
  return t === "slow-2g" || t === "2g" || t === "3g";
}

export function isMobilePlayback(): boolean {
  if (typeof window === "undefined") return false;
  if (/Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(navigator.userAgent)) return true;
  return window.matchMedia("(pointer: coarse)").matches;
}

/** Exponential backoff: 1000ms → 2000ms → 4000ms → 6000ms (cap). */
export function linkRetryDelayMs(attempt: number): number {
  return Math.min(6000, 1000 * 2 ** Math.max(0, attempt));
}

/**
 * Production HLS settings for live IPTV/sports (standard HLS, not LL-HLS).
 * Tighter buffers on mobile/slow networks for faster start and less stall risk.
 */
export function buildHlsConfig(opts: { lightNet: boolean; mobile: boolean }): Partial<HlsConfig> {
  const constrained = opts.lightNet || opts.mobile;
  return {
    enableWorker: true,
    lowLatencyMode: false,
    startFragPrefetch: true,
    testBandwidth: true,
    progressive: false,
    maxBufferLength: constrained ? 12 : 24,
    maxMaxBufferLength: constrained ? 20 : 45,
    backBufferLength: constrained ? 6 : 12,
    maxBufferSize: constrained ? 22 * 1000 * 1000 : 50 * 1000 * 1000,
    maxBufferHole: 0.5,
    highBufferWatchdogPeriod: 2,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 8,
    liveSyncDurationCount: constrained ? 3 : 4,
    liveMaxLatencyDurationCount: constrained ? 8 : 12,
    liveDurationInfinity: true,
    liveBackBufferLength: constrained ? 0 : 4,
    abrEwmaDefaultEstimate: constrained ? 350_000 : 900_000,
    abrBandWidthFactor: constrained ? 0.88 : 0.93,
    abrBandWidthUpFactor: constrained ? 0.5 : 0.65,
    abrMaxWithRealBitrate: true,
    manifestLoadingTimeOut: HLS_MANIFEST_LOAD_TIMEOUT_MS,
    manifestLoadingMaxRetry: HLS_MANIFEST_MAX_RETRY,
    manifestLoadingRetryDelay: 1000,
    levelLoadingTimeOut: HLS_LEVEL_LOAD_TIMEOUT_MS,
    levelLoadingMaxRetry: HLS_LEVEL_MAX_RETRY,
    levelLoadingRetryDelay: 800,
    fragLoadingTimeOut: HLS_FRAG_LOAD_TIMEOUT_MS,
    fragLoadingMaxRetry: HLS_FRAG_MAX_RETRY,
    fragLoadingRetryDelay: constrained ? 1200 : 800,
    startLevel: -1,
    capLevelToPlayerSize: true,
  };
}

export function trySilentHlsRecovery(hls: Hls): boolean {
  try {
    hls.startLoad(-1);
    return true;
  } catch {
    /* */
  }
  try {
    hls.recoverMediaError();
    return true;
  } catch {
    /* */
  }
  return false;
}

export function downgradeHlsQuality(hls: Hls): void {
  if (!hls.levels.length) return;
  if (hls.autoLevelCapping >= 0) {
    hls.autoLevelCapping = Math.max(0, hls.autoLevelCapping - 1);
    return;
  }
  if (hls.currentLevel > 0) hls.currentLevel -= 1;
}

export function upgradeHlsQuality(hls: Hls): void {
  if (!hls.levels.length) return;
  const max = hls.levels.length - 1;
  if (hls.autoLevelCapping >= 0 && hls.autoLevelCapping < max) {
    hls.autoLevelCapping = Math.min(max, hls.autoLevelCapping + 1);
  }
}

export type StreamHealthSnapshot = {
  startupMs: number | null;
  stallCount: number;
  errorCount: number;
  latencySec: number | null;
};

/** Tracks stalls/errors and triggers ABR cap changes during instability. */
export class StreamHealthTracker {
  private loadStart = Date.now();
  private stalls = 0;
  private errors = 0;
  private startupMs: number | null = null;
  private stallTimestamps: number[] = [];
  private stableSince: number | null = null;
  private stableTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly onDowngrade: () => void,
    private readonly onUpgrade: () => void
  ) {}

  startStableWatch(): void {
    this.stopStableWatch();
    this.stableTimer = setInterval(() => {
      if (this.stableSince && Date.now() - this.stableSince >= 60_000) {
        this.onUpgrade();
        this.stableSince = Date.now();
      }
    }, 15_000);
  }

  stopStableWatch(): void {
    if (this.stableTimer) {
      clearInterval(this.stableTimer);
      this.stableTimer = null;
    }
  }

  reset(): void {
    this.loadStart = Date.now();
    this.stalls = 0;
    this.errors = 0;
    this.startupMs = null;
    this.stallTimestamps = [];
    this.stableSince = null;
  }

  recordPlaying(): void {
    if (this.startupMs == null) this.startupMs = Date.now() - this.loadStart;
    this.stableSince = Date.now();
  }

  recordStall(): void {
    this.stalls += 1;
    const now = Date.now();
    this.stallTimestamps = this.stallTimestamps.filter((t) => now - t < 20_000);
    this.stallTimestamps.push(now);
    this.stableSince = null;
    if (this.stallTimestamps.length >= 2) {
      this.onDowngrade();
      this.stallTimestamps = [];
    }
  }

  recordError(): void {
    this.errors += 1;
    this.stableSince = null;
  }

  latencyFromHls(hls: Hls | null): number | null {
    if (!hls?.latency) return null;
    const l = hls.latency;
    return Number.isFinite(l) && l >= 0 ? l : null;
  }

  snapshot(hls: Hls | null): StreamHealthSnapshot {
    return {
      startupMs: this.startupMs,
      stallCount: this.stalls,
      errorCount: this.errors,
      latencySec: this.latencyFromHls(hls),
    };
  }

  destroy(): void {
    this.stopStableWatch();
  }
}
