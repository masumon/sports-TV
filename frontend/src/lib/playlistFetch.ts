import { buildApiUrl } from "@/lib/apiClient";

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
  const res = await fetch(buildApiUrl(`/proxy/playlist?${sp.toString()}`), {
    method: "GET",
    cache: "no-store",
  });
  if (res.status === 403) {
    try {
      const j = (await res.json()) as { code?: string };
      if (j?.code === "GEO_RESTRICTED") throw new GeoRestrictedError();
    } catch (e) {
      if (e instanceof GeoRestrictedError) throw e;
    }
    throw new GeoRestrictedError();
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t.slice(0, 200) || `Playlist fetch failed (${res.status})`);
  }
  return res.text();
}
