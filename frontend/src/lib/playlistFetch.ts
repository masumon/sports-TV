import { buildApiUrl } from "@/lib/apiClient";

/** Slightly above backend httpx read timeout so the client fails cleanly if the proxy stalls. */
const PLAYLIST_FETCH_TIMEOUT_MS = 45_000;

export class GeoRestrictedError extends Error {
  readonly code = "GEO_RESTRICTED";
  constructor(message = "Geo-restricted") {
    super(message);
    this.name = "GeoRestrictedError";
  }
}

/**
 * GitHub raw content and GitHub Pages always respond with `Access-Control-Allow-Origin: *`,
 * so the browser can fetch them directly without going through the Render proxy.
 * This eliminates Render cold-start delay (30-60s) for catalog M3U loading.
 */
function isCorsSafeUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "raw.githubusercontent.com" || hostname.endsWith(".github.io");
  } catch {
    return false;
  }
}

/**
 * Fetch raw M3U text.
 * - CORS-safe sources (GitHub raw / GitHub Pages): fetched directly from the browser.
 * - All other sources: fetched via backend `/proxy/playlist` (CORS-safe, SSRF-guarded).
 */
export async function fetchPlaylistText(
  playlistUrl: string,
  headerProfile?: string | null
): Promise<string> {
  // Direct path: bypass Render proxy for GitHub raw / GitHub Pages
  if (!headerProfile && isCorsSafeUrl(playlistUrl)) {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), PLAYLIST_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(playlistUrl, { method: "GET", cache: "no-store", signal: ac.signal });
      if (res.ok) return res.text();
    } catch {
      // Fall through to proxy on network error
    } finally {
      clearTimeout(tid);
    }
  }

  // Proxy path for non-CORS sources or when direct fetch failed
  const sp = new URLSearchParams();
  sp.set("url", playlistUrl);
  if (headerProfile) sp.set("header_profile", headerProfile);

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), PLAYLIST_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(buildApiUrl(`/proxy/playlist?${sp.toString()}`), {
      method: "GET",
      cache: "no-store",
      signal: ac.signal,
    });
    if (res.status === 403) {
      try {
        const j = (await res.json()) as { code?: string };
        if (j?.code === "GEO_RESTRICTED") throw new GeoRestrictedError();
      } catch (e) {
        if (e instanceof GeoRestrictedError) throw e;
      }
      throw new Error("Playlist fetch forbidden (403)");
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(t.slice(0, 200) || `Playlist fetch failed (${res.status})`);
    }
    return res.text();
  } finally {
    clearTimeout(tid);
  }
}
