/**
 * CricHD live channels direct fetcher.
 *
 * Fetches the M3U playlist directly from raw.githubusercontent.com (CORS-open)
 * WITHOUT the backend proxy. The playlist uses tokenized CDN URLs (md5+expires)
 * that rotate every ~30 minutes — the 90-min proxy cache would serve expired tokens.
 *
 * Each channel gets header_profile="crichd" so the backend proxy injects the
 * correct Referer header when streaming.
 */
import { parseM3UPlaylist } from "@/lib/m3uParser";
import type { Channel } from "@/lib/types";

const CRICHD_M3U_URL =
  "https://raw.githubusercontent.com/sm-monirulislam/CricHD-Auto-Update-Playlist/main/crichd.m3u";
const FETCH_TIMEOUT_MS = 20_000;

function stableId(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i);
    h |= 0;
  }
  return h === 0 ? -998 : -Math.abs(h) - 100_000;
}

export async function fetchCricHDChannels(): Promise<Channel[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(CRICHD_M3U_URL, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (!text.trim().startsWith("#EXTM3U")) return []; // safety: reject non-M3U
    const entries = parseM3UPlaylist(text);
    const emptyTs = { created_at: "", updated_at: "" };
    const seen = new Set<string>();
    return entries
      .filter((e) => {
        const url = e.streamUrl.trim();
        if (!url.startsWith("http")) return false;
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
      })
      .map((e) => ({
        id: stableId(`crichd:${e.streamUrl}`),
        name: e.name.trim() || "CricHD Channel",
        country: "Global",
        category: (e.groupTitle || "CricHD").trim(),
        language: "en",
        logo_url: e.logoUrl ?? null,
        stream_url: e.streamUrl.trim(),
        alternate_urls: [] as string[],
        quality_tag: "live",
        module: "global_sports",
        is_active: true,
        geo_hint: false,
        // Tells the stream proxy to inject Referer: https://executeandship.com/
        header_profile: "crichd",
        ...emptyTs,
      } satisfies Channel));
  } catch {
    // Network error, timeout, or malformed — silently return empty
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}
