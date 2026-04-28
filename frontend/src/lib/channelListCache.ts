import type { Channel } from "@/lib/types";

const KEY = "gstv-channel-catalog-v2";
const TTL_MS = 10 * 60 * 1000; // 10 min — align with API/CDN ~5m cache; refresh in background

type Payload = { t: number; items: Channel[] };

/** Drop stale idle writes if a newer catalog finishes loading first. */
let cacheWriteGeneration = 0;

export function getChannelListCache(): Channel[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Payload;
    if (!p?.t || !Array.isArray(p.items)) return null;
    if (Date.now() - p.t > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return p.items;
  } catch {
    return null;
  }
}

export function setChannelListCache(channels: Channel[]): void {
  if (typeof window === "undefined") return;
  const gen = ++cacheWriteGeneration;
  const flush = () => {
    if (gen !== cacheWriteGeneration) return;
    try {
      const p: Payload = { t: Date.now(), items: channels };
      const s = JSON.stringify(p);
      if (s.length > 4_200_000) {
        // ~4MB localStorage guard — skip if huge
        return;
      }
      localStorage.setItem(KEY, s);
    } catch {
      /* quota / private mode */
    }
  };
  // Large catalogs: stringify + setItem on the main thread freezes the tab; defer until idle.
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(flush, { timeout: 4000 });
  } else {
    setTimeout(flush, 0);
  }
}

export function clearChannelListCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* */
  }
}
