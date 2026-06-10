/**
 * FanCode M3U direct fetcher.
 *
 * Fetches the M3U playlist directly from raw.githubusercontent.com (CORS-open)
 * WITHOUT the backend proxy — so we always get the latest URLs (updates every 7 min).
 * Proxy cache would serve 90-min stale data which defeats the purpose.
 */
import { parseM3UPlaylist } from "@/lib/m3uParser";
import type { Channel } from "@/lib/types";

const FANCODE_M3U_URL =
  "https://raw.githubusercontent.com/kajju027/Fancode-Events-Json/main/fancode.m3u";
const FETCH_TIMEOUT_MS = 15_000;

function stableId(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i);
    h |= 0;
  }
  // Use negative range to avoid collision with DB channel IDs (positive) and
  // fancodeLive.ts stableId (different seed prefix).
  return h === 0 ? -999 : -Math.abs(h);
}

export async function fetchFanCodeM3UChannels(): Promise<Channel[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(FANCODE_M3U_URL, {
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
        id: stableId(`fancode-m3u:${e.streamUrl}`),
        name: e.name.trim() || "FanCode Live",
        country: "International",
        category: (e.groupTitle || "live").trim(),
        language: "en",
        logo_url: e.logoUrl ?? null,
        stream_url: e.streamUrl.trim(),
        alternate_urls: [] as string[],
        quality_tag: "live",
        module: "live_matches",
        is_active: true,
        geo_hint: true,
        header_profile: null,
        ...emptyTs,
      } satisfies Channel));
  } catch {
    // Network error, timeout, or malformed content — silently return empty
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}
