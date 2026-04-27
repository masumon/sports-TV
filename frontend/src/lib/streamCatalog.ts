import { APP_STREAM_CONFIG } from "@/lib/appStreamConfig";
import { fetchFanCodeLiveChannels } from "@/lib/fancodeLive";
import { parseM3UPlaylist } from "@/lib/m3uParser";
import { fetchPlaylistText } from "@/lib/playlistFetch";
import type { Channel, ViewerModule } from "@/lib/types";

/** Caps concurrent `/proxy/playlist` calls so Render free tier is not hit with 10+ upstream fetches at once. */
function createConcurrencyLimit(maxConcurrent: number) {
  let running = 0;
  const queue: Array<() => void> = [];
  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    while (running >= maxConcurrent) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    running++;
    try {
      return await fn();
    } finally {
      running--;
      const next = queue.shift();
      if (next) next();
    }
  };
}

const limitPlaylistFetch = createConcurrencyLimit(5);

function stableId(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i);
    h |= 0;
  }
  return h === 0 ? -1 : h;
}

function normKey(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    return u.toString();
  } catch {
    return url.trim();
  }
}

function entryToChannel(
  e: { name: string; streamUrl: string; logoUrl: string | null; groupTitle: string | null },
  module: ViewerModule,
  countryFallback: string
): Channel {
  const group = e.groupTitle?.trim() || "";
  const emptyTs = { created_at: "", updated_at: "" };
  return {
    id: stableId(`${module}:${normKey(e.streamUrl)}:${e.name}`),
    name: e.name.trim() || "Channel",
    country: group.split(";")[0]?.trim() || countryFallback,
    category: group || "General",
    language: "multi",
    logo_url: e.logoUrl,
    stream_url: e.streamUrl.trim(),
    alternate_urls: [],
    quality_tag: "auto",
    module,
    is_active: true,
    header_profile: null,
    geo_hint: false,
    ...emptyTs,
  };
}

async function ingestPlaylistUrls(
  urls: readonly string[],
  module: ViewerModule,
  countryFallback: string,
  seen: Set<string>,
  out: Channel[]
): Promise<void> {
  const valid = urls.filter((u) => u && u.startsWith("http"));
  if (!valid.length) return;

  /** Parallel fetches per group, globally throttled — faster than serial, bounded for free-tier backend. */
  const settled = await Promise.allSettled(
    valid.map((u) => limitPlaylistFetch(() => fetchPlaylistText(u)))
  );

  for (let i = 0; i < valid.length; i++) {
    const result = settled[i];
    if (result.status !== "fulfilled") continue;
    try {
      const entries = parseM3UPlaylist(result.value);
      for (const e of entries) {
        const k = normKey(e.streamUrl);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(entryToChannel(e, module, countryFallback));
      }
    } catch {
      /* skip malformed playlist */
    }
  }
}

function mergePremiumDirectSports(seen: Set<string>, out: Channel[]): void {
  const raw = APP_STREAM_CONFIG.premium_direct_sports;
  if (!raw?.length) return;

  const emptyTs = { created_at: "", updated_at: "" };
  for (const p of raw) {
    const url = (p.stream_url || "").trim();
    if (!url.startsWith("http")) continue;
    const k = normKey(url);
    if (seen.has(k)) continue;
    seen.add(k);

    const mod = p.module;
    const country =
      p.country?.trim() ||
      (mod === "bangladesh" ? "Bangladesh" : mod === "india" ? "India" : "Global");

    out.push({
      id: stableId(`premium:${k}:${p.name}`),
      name: p.name?.trim() || "Premium sports",
      country,
      category: p.category?.trim() || "Sports",
      language: "multi",
      logo_url: p.logo_url ?? null,
      stream_url: url,
      alternate_urls: [...(p.alternate_urls ?? [])].filter((u) => u.startsWith("http")),
      quality_tag: "live",
      module: mod,
      is_active: true,
      header_profile: null,
      geo_hint: Boolean(p.geo_hint),
      ...emptyTs,
    });
  }
}

/**
 * Load merged catalog: FAST → Bangladesh → India → global masters → premium direct (deduped).
 * FanCode live rows are merged in loadFullCatalogWithLive / 30m refresh on the client.
 */
export async function loadStaticCatalogChannels(): Promise<Channel[]> {
  const seen = new Set<string>();
  const out: Channel[] = [];

  const fastUrls = Object.values(APP_STREAM_CONFIG.fast_tv_sources);
  await ingestPlaylistUrls(fastUrls, "fast_tv", "Global", seen, out);

  const bdUrls = APP_STREAM_CONFIG.country_playlists.bangladesh_and_bdix;
  await ingestPlaylistUrls(bdUrls, "bangladesh", "Bangladesh", seen, out);

  const inUrls = APP_STREAM_CONFIG.country_playlists.india;
  await ingestPlaylistUrls(inUrls, "india", "India", seen, out);

  await ingestPlaylistUrls(
    APP_STREAM_CONFIG.dynamic_master_playlists,
    "global_sports",
    "Global",
    seen,
    out
  );

  mergePremiumDirectSports(seen, out);

  return out;
}

export async function loadFullCatalogWithLive(): Promise<Channel[]> {
  const base = await loadStaticCatalogChannels();
  try {
    const live = await fetchFanCodeLiveChannels();
    return [...base, ...live];
  } catch {
    return base;
  }
}

export function replaceLiveMatches(channels: Channel[], live: Channel[]): Channel[] {
  const base = channels.filter((c) => c.module !== "live_matches");
  return [...base, ...live];
}
