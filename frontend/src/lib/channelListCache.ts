import type { Channel } from "@/lib/types";
import {
  clearChannelCatalogIdb,
  getChannelCatalogFromIdb,
  getStaleChannelCatalogFromIdb,
  setChannelCatalogToIdb,
} from "@/lib/channelCatalogIdb";

const KEY = "gstv-channel-catalog-v2";
const TTL_MS = 10 * 60 * 1000; // localStorage mirror — shorter TTL

type Payload = { t: number; items: Channel[] };

let cacheWriteGeneration = 0;
let idbHydratePromise: Promise<Channel[] | null> | null = null;

function readLocalStorageCache(allowStale = false): Channel[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Payload;
    if (!p?.t || !Array.isArray(p.items)) return null;
    if (!allowStale && Date.now() - p.t > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return p.items;
  } catch {
    return null;
  }
}

/** Sync read — localStorage only (SSR-safe callers use null on server). */
export function getChannelListCache(): Channel[] | null {
  return readLocalStorageCache(false);
}

/** Sync read — includes expired localStorage entries for stale-while-revalidate UX. */
export function getStaleChannelListCache(): Channel[] | null {
  return readLocalStorageCache(true);
}

/**
 * Cache-first hydrate: localStorage → IndexedDB (async).
 * Call on mount before network; updates React state when IDB returns fresher/larger data.
 */
export async function hydrateChannelListCache(): Promise<Channel[] | null> {
  const local = readLocalStorageCache(false);
  if (local?.length) return local;

  const staleLocal = readLocalStorageCache(true);
  if (staleLocal?.length) return staleLocal;

  if (!idbHydratePromise) {
    idbHydratePromise = (async () => {
      const fresh = await getChannelCatalogFromIdb();
      if (fresh?.length) return fresh;
      return getStaleChannelCatalogFromIdb();
    })().finally(() => {
      idbHydratePromise = null;
    });
  }
  const idb = await idbHydratePromise;
  if (idb?.length) {
    setChannelListCache(idb, { skipIdb: true });
    return idb;
  }
  return null;
}

export function setChannelListCache(
  channels: Channel[],
  opts?: { skipIdb?: boolean },
): void {
  if (typeof window === "undefined") return;
  const gen = ++cacheWriteGeneration;

  const flushLocal = () => {
    if (gen !== cacheWriteGeneration) return;
    try {
      const p: Payload = { t: Date.now(), items: channels };
      const s = JSON.stringify(p);
      if (s.length > 4_200_000) return;
      localStorage.setItem(KEY, s);
    } catch {
      /* quota */
    }
  };

  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(flushLocal, { timeout: 4000 });
  } else {
    setTimeout(flushLocal, 0);
  }

  if (!opts?.skipIdb) {
    void setChannelCatalogToIdb(channels);
  }
}

export function clearChannelListCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* */
  }
  void clearChannelCatalogIdb();
}
