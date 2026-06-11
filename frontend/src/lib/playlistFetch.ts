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
 * Fetch raw M3U text via backend `/proxy/playlist` (CORS-safe, SSRF-guarded).
 */
export async function fetchPlaylistText(
  playlistUrl: string,
  headerProfile?: string | null
): Promise<string> {
  const sp = new URLSearchParams();
  sp.set("url", playlistUrl);
  if (headerProfile) sp.set("header_profile", headerProfile);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PLAYLIST_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(buildApiUrl(`/proxy/playlist?${sp.toString()}`), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
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
    clearTimeout(timeoutId);
  }
}
