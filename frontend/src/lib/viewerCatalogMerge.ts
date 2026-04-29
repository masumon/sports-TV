import { orderedStreamUrlsForChannel } from "@/lib/channelStreams";
import type { Channel } from "@/lib/types";

function normStreamUrlKey(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    return u.toString();
  } catch {
    return url.trim();
  }
}

/** Legacy DB / scraper slug `sports` → home UI tab `global_sports`. */
export function viewerModuleFromDbModule(module: string): string {
  const m = module.trim().toLowerCase();
  if (m === "sports") return "global_sports";
  return module;
}

function mergeOrderedUrls(viewer: Channel, db: Channel): { stream_url: string; alternate_urls: string[] } {
  const v = orderedStreamUrlsForChannel(viewer);
  const d = orderedStreamUrlsForChannel(db);
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const u of [...v, ...d]) {
    const k = normStreamUrlKey(u);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(u.trim());
  }
  if (!merged.length) {
    return { stream_url: viewer.stream_url, alternate_urls: [...(viewer.alternate_urls ?? [])] };
  }
  return { stream_url: merged[0]!, alternate_urls: merged.slice(1) };
}

/**
 * Enrich browser-fetched M3U rows with DB fields when any stream URL matches an active DB channel
 * (same sync pipeline as admin). Keeps viewer ordering/metadata first; adds DB mirrors + `header_profile`.
 */
export function mergeDbChannelsIntoViewerCatalog(
  viewer: readonly Channel[],
  db: readonly Channel[]
): Channel[] {
  const activeDb = db.filter((c) => c.is_active);
  const urlToDb = new Map<string, Channel>();
  for (const ch of activeDb) {
    for (const u of orderedStreamUrlsForChannel(ch)) {
      const k = normStreamUrlKey(u);
      if (!urlToDb.has(k)) urlToDb.set(k, ch);
    }
  }

  return viewer.map((v) => {
    const mod = viewerModuleFromDbModule(v.module);
    let dbMatch: Channel | undefined;
    for (const u of orderedStreamUrlsForChannel(v)) {
      const hit = urlToDb.get(normStreamUrlKey(u));
      if (hit) {
        dbMatch = hit;
        break;
      }
    }
    if (!dbMatch) {
      return { ...v, module: mod };
    }
    const urls = mergeOrderedUrls(v, dbMatch);
    return {
      ...v,
      ...urls,
      module: mod,
      header_profile: v.header_profile ?? dbMatch.header_profile ?? null,
      geo_hint: Boolean(v.geo_hint || dbMatch.geo_hint),
    };
  });
}
