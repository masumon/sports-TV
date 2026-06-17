import { APP_STREAM_CONFIG } from "@/lib/appStreamConfig";
import { fetchFanCodeLiveChannels } from "@/lib/fancodeLive";
import { fetchFanCodeM3UChannels } from "@/lib/fancodeM3U";
import { fetchCricHDChannels } from "@/lib/crichdLive";
import { parseM3UPlaylist } from "@/lib/m3uParser";
import { fetchPlaylistText } from "@/lib/playlistFetch";
import { expandPlaylistUrls } from "@/lib/playlistSources";
import type { Channel, PremiumDirectModule, ViewerModule } from "@/lib/types";

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

/**
 * Strip quality/status tags from channel names for name-based deduplication.
 * Mirrors the backend Python `_CHAN_NORM_RE` regex so duplicate entries from
 * different M3U sources ("BTV HD" and "BTV") collapse into one channel with
 * both URLs available as failover.
 */
const CHAN_NORM_RE = /\s*[\[(](?:\d{3,4}p|fhd|uhd|4k|hd|sd|geo[\s-]?block(?:ed)?|stream\s*\d*|backup\s*\d*|mirror\s*\d*|alt\s*\d*|live|auto|main|primary)[\])]\s*/gi;
const CHAN_SUFFIX_NORM_RE = /\s+(?:\d{3,4}p|fhd|uhd|4k|hd|sd|live|auto|main|primary)\s*$/i;
const GEO_BLOCK_HINT_RE = /(?:geo[\s-]?block(?:ed)?|region[\s-]?(?:lock(?:ed)?|restrict(?:ed)?)|country[\s-]?(?:lock(?:ed)?|restrict(?:ed)?))/i;

function normalizeNameForDedup(name: string): string {
  return name
    .replace(CHAN_NORM_RE, " ")
    .replace(CHAN_SUFFIX_NORM_RE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * After all M3U + premium entries are collected, merge channels that share
 * the same module + country + normalized name into a single entry, collecting
 * all their stream URLs as failover alternates.
 *
 * This ensures that e.g. "BTV" from iptv-org and "BTV" from a BDIX playlist
 * appear as ONE card with two URLs, not two separate cards.
 */
function deduplicateByModuleName(channels: Channel[]): Channel[] {
  const byKey = new Map<string, Channel>();
  const urlSeen = new Set<string>();

  for (const ch of channels) {
    // For regional modules, dedup by module+country+name.
    // For global_sports/fast_tv/world_cup_2026, names can legitimately repeat across
    // countries so include country in the key to avoid accidental merges.
    const key = `${ch.module}::${ch.country.toLowerCase()}::${normalizeNameForDedup(ch.name)}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, {
        ...ch,
        alternate_urls: [...(ch.alternate_urls ?? [])],
      });
      urlSeen.add(normKey(ch.stream_url));
      for (const u of ch.alternate_urls ?? []) urlSeen.add(normKey(u));
    } else {
      // Merge new URLs as additional failover alternates (deduped)
      for (const u of [ch.stream_url, ...(ch.alternate_urls ?? [])]) {
        const k = normKey(u);
        if (!urlSeen.has(k)) {
          urlSeen.add(k);
          existing.alternate_urls = [...(existing.alternate_urls ?? []), u];
        }
      }
      // Prefer an entry with a logo if the existing one has none
      if (!existing.logo_url && ch.logo_url) existing.logo_url = ch.logo_url;
    }
  }

  return [...byKey.values()];
}

/**
 * Auto-detect backend header profile from stream URL or extracted M3U headers.
 * Only sets known allowlisted profiles — no arbitrary header injection.
 */
function detectHeaderProfile(
  streamUrl: string,
  userAgent?: string | null,
): string | null {
  const url = streamUrl.toLowerCase();
  const ua = (userAgent ?? "").toLowerCase();

  if (
    url.includes("tsports") ||
    url.includes("live-cdn.tsports") ||
    ua.includes("tsports")
  ) return "tsports";

  // Star Sports / Disney+ Hotstar CDN patterns
  if (
    url.includes("starsports") ||
    url.includes("star-sports") ||
    url.includes("star_sports") ||
    url.includes("hotstar") ||
    ua.includes("hotstar") ||
    ua.includes("starsports")
  ) return "star_sports";

  // Sony LIV / Sony Sports / Sony Ten CDN patterns
  if (
    url.includes("sonyliv") ||
    url.includes("sony_ten") ||
    url.includes("sonyten") ||
    url.includes("sonysports") ||
    url.includes("sony-sports") ||
    ua.includes("sonyliv")
  ) return "sony_sports";

  return null;
}

/**
 * Infer a header profile from channel name when URL-based detection fails.
 * Used for IP-address-based mirror URLs that carry no CDN fingerprint.
 */
function detectHeaderProfileFromName(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("star sports") || n.includes("starsports") || n.includes("hotstar")) {
    return "star_sports";
  }
  if (
    n.includes("sony ten") ||
    n.includes("sony sports") ||
    n.includes("sonyliv") ||
    n.includes("sony liv")
  ) {
    return "sony_sports";
  }
  return null;
}

function entryToChannel(
  e: { name: string; streamUrl: string; logoUrl: string | null; groupTitle: string | null; userAgent?: string | null; referer?: string | null },
  module: ViewerModule,
  countryFallback: string
): Channel {
  const group = e.groupTitle?.trim() || "";
  const emptyTs = { created_at: "", updated_at: "" };
  // Mark as geo-restricted if name/group contains geo-block keywords, or if channel is a
  // known Indian sports broadcaster (Star Sports / Sony Sports are India-region-locked).
  const geoHint =
    GEO_BLOCK_HINT_RE.test(`${e.name} ${group}`) ||
    detectHeaderProfileFromName(e.name) !== null;
  const headerProfile =
    detectHeaderProfile(e.streamUrl, e.userAgent) ??
    detectHeaderProfileFromName(e.name);
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
    header_profile: headerProfile,
    geo_hint: geoHint,
    ...emptyTs,
  };
}

function isFootballOrCricketEntry(name: string, groupTitle: string): boolean {
  const n = name.toLowerCase();
  const g = groupTitle.toLowerCase();
  const footballKeywords = [
    "football",
    "soccer",
    "futbol",
    "fussball",
    "laliga",
    "la liga",
    "premier league",
    "champions league",
    "serie a",
    "bundesliga",
    "ligue 1",
    "uefa",
    "fifa",
    "copa",
  ];
  const cricketKeywords = ["cricket", "ipl", "icc", "bpl", "psl", "t20", "odi", "test match"];
  return [...footballKeywords, ...cricketKeywords].some((k) => n.includes(k) || g.includes(k));
}

async function ingestPlaylistUrlsIntoSeen(
  urls: readonly string[],
  module: ViewerModule,
  countryFallback: string,
  seen: Set<string>,
  out: Channel[] | null
): Promise<void> {
  const valid = expandPlaylistUrls(urls);
  if (!valid.length) return;

  /** Parallel fetches per group, globally throttled — faster than serial, bounded for free-tier backend. */
  const settled = await Promise.allSettled(
    valid.map((u) =>
      limitPlaylistFetch(() =>
        Promise.race([
          fetchPlaylistText(u),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("playlist_fetch_timeout")), 25_000)
          ),
        ])
      )
    )
  );

  for (let i = 0; i < valid.length; i++) {
    const result = settled[i];
    if (result.status !== "fulfilled") continue;
    try {
      const entries = parseM3UPlaylist(result.value);
      for (const e of entries) {
        if (module === "global_sports" && !isFootballOrCricketEntry(e.name, e.groupTitle ?? "")) {
          continue;
        }
        const k = normKey(e.streamUrl);
        if (seen.has(k)) continue;
        seen.add(k);
        if (out) out.push(entryToChannel(e, module, countryFallback));
      }
    } catch {
      /* skip malformed playlist */
    }
  }
}

async function ingestPlaylistUrls(
  urls: readonly string[],
  module: ViewerModule,
  countryFallback: string,
  seen: Set<string>,
  out: Channel[]
): Promise<void> {
  await ingestPlaylistUrlsIntoSeen(urls, module, countryFallback, seen, out);
}

function resolvePremiumModule(mod: PremiumDirectModule): ViewerModule {
  return mod;
}

function mergePremiumDirectSportsIntoSeen(seen: Set<string>, out: Channel[] | null): void {
  const raw = APP_STREAM_CONFIG.premium_direct_sports;
  if (!raw?.length) return;

  for (const p of raw) {
    const collected: string[] = [];
    const keySeen = new Set<string>();
    for (const u of [...(p.stream_urls ?? []), ...(p.stream_url ? [p.stream_url] : []), ...(p.alternate_urls ?? [])]) {
      const t = (u || "").trim();
      if (!t.startsWith("http")) continue;
      const nk = normKey(t);
      if (keySeen.has(nk)) continue;
      keySeen.add(nk);
      collected.push(t);
    }
    if (!collected.length) continue;

    const primary = collected[0]!;
    const k = normKey(primary);
    if (seen.has(k)) continue;
    seen.add(k);

    if (!out) continue;

    const emptyTs = { created_at: "", updated_at: "" };
    const mod = resolvePremiumModule(p.module);
    if (mod === "global_sports" && !isFootballOrCricketEntry(p.name, p.category ?? "")) {
      continue;
    }
    const country =
      p.country?.trim() ||
      (mod === "world_cup_2026" ? "Global" : "Global");

    out.push({
      id: stableId(`premium:${k}:${p.name}`),
      name: p.name?.trim() || "Premium sports",
      country,
      category: p.category?.trim() || "Sports",
      language: "multi",
      logo_url: p.logo_url ?? null,
      stream_url: primary,
      alternate_urls: collected.slice(1),
      quality_tag: "live",
      module: mod,
      is_active: true,
      header_profile: p.header_profile ?? null,
      geo_hint: Boolean(p.geo_hint),
      ...emptyTs,
    });
  }
}

/**
 * Load merged catalog: premium direct entries FIRST (so their failover URLs are
 * preserved), then FAST → Bangladesh → India → global masters (URL-deduped).
 * Finally, name-dedup merges same-channel entries from different M3U sources
 * into single cards with all URLs available as failover.
 *
 * FanCode live rows are merged in loadFullCatalogWithLive / 30m refresh on the client.
 */
export async function loadStaticCatalogChannels(): Promise<Channel[]> {
  const seen = new Set<string>();
  const out: Channel[] = [];

  // Premium direct entries FIRST — their failover chains must not be overwritten
  // by later M3U entries claiming the same primary URL with no alternates.
  mergePremiumDirectSportsIntoSeen(seen, out);

  // World Cup playlists (T Sports, LegalStream) — no sport keyword filter
  await ingestPlaylistUrls(APP_STREAM_CONFIG.world_cup_playlists, "world_cup_2026", "Global", seen, out);

  // Global sports playlists — football/cricket keyword filter applied inside ingestPlaylistUrls
  await ingestPlaylistUrls(APP_STREAM_CONFIG.global_sports_playlists, "global_sports", "Global", seen, out);

  // Name-based dedup: collapse same-name channels from different M3U sources
  // into one card with all their URLs as failover alternates.
  return deduplicateByModuleName(out);
}

/**
 * Same dedupe rules as {@link loadStaticCatalogChannels} but only counts rows (no `Channel` objects).
 * Use for admin stats so totals match the viewer home catalog.
 */
export async function countStaticCatalogChannels(): Promise<number> {
  const seen = new Set<string>();

  mergePremiumDirectSportsIntoSeen(seen, null);
  await ingestPlaylistUrlsIntoSeen(APP_STREAM_CONFIG.world_cup_playlists, "world_cup_2026", "Global", seen, null);
  await ingestPlaylistUrlsIntoSeen(APP_STREAM_CONFIG.global_sports_playlists, "global_sports", "Global", seen, null);
  return seen.size;
}

/**
 * Total rows the viewer loads: static M3U merge + FanCode live list (same as {@link loadFullCatalogWithLive} `.length`).
 */
export async function countFullViewerCatalogChannels(): Promise<number> {
  const staticCount = await countStaticCatalogChannels();
  try {
    const live = await fetchAllLiveMatchChannels();
    return staticCount + live.length;
  } catch {
    return staticCount;
  }
}

export async function loadFullCatalogWithLive(): Promise<Channel[]> {
  try {
    // Timeout on total catalog load: if >15s, return base + timeout message
    const result = await Promise.race([
      (async () => {
        const base = await loadStaticCatalogChannels();
        const [fancodeJson, fancodeM3u, crichd] = await Promise.allSettled([
          fetchFanCodeLiveChannels(),
          fetchFanCodeM3UChannels(),
          fetchCricHDChannels(),
        ]);
        const live: Channel[] = [
          ...(fancodeJson.status === "fulfilled" ? fancodeJson.value : []),
          ...(fancodeM3u.status === "fulfilled" ? fancodeM3u.value : []),
          ...(crichd.status === "fulfilled" ? crichd.value : []),
        ];
        const allSeen = new Set(base.map((c) => c.stream_url.trim()));
        const dedupedLive = live.filter((c) => {
          const url = c.stream_url.trim();
          if (allSeen.has(url)) return false;
          allSeen.add(url);
          return true;
        });
        return [...base, ...dedupedLive];
      })(),
      new Promise<Channel[]>((_, reject) =>
        setTimeout(() => reject(new Error("load_timeout")), 15_000)
      ),
    ]);
    return result;
  } catch (err) {
    // On timeout, return static base only (live channels can load in background)
    if (err instanceof Error && err.message === "load_timeout") {
      console.warn("Live channel load timeout — showing static channels only");
      return loadStaticCatalogChannels();
    }
    throw err;
  }
}

/** All live-match channel sources merged — used by the 30-minute background refresh. */
export async function fetchAllLiveMatchChannels(): Promise<Channel[]> {
  const [fancodeJson, fancodeM3u] = await Promise.allSettled([
    fetchFanCodeLiveChannels(),
    fetchFanCodeM3UChannels(),
  ]);
  const combined: Channel[] = [
    ...(fancodeJson.status === "fulfilled" ? fancodeJson.value : []),
    ...(fancodeM3u.status === "fulfilled" ? fancodeM3u.value : []),
  ];
  // Dedup within the combined live array
  const seen = new Set<string>();
  return combined.filter((c) => {
    const url = c.stream_url.trim();
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

export function replaceLiveMatches(channels: Channel[], live: Channel[]): Channel[] {
  const base = channels.filter((c) => c.module !== "live_matches");
  return [...base, ...live];
}
