import { buildApiUrl } from "@/lib/apiClient";

/**
 * If `stream_url` (or an alternate) points at our HLS manifest proxy, return the
 * `stream_id` query so the client can re-send it (segment URLs need the same
 * `stream_id` for server-side auth headers from the DB).
 */
export function parseDynamicM3U8IdFromStreamUrl(
  url: string
): number | null {
  if (!url.includes("proxy/m3u8")) return null;
  try {
    const u = new URL(
      url,
      typeof window !== "undefined" ? window.location.origin : "https://localhost"
    );
    const id = u.searchParams.get("stream_id");
    if (id == null || id === "") return null;
    const n = Number(id);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * Appends `stream_id` to a proxied m3u8 URL when the admin UI stores
 * `dynamic_m3u8_id` but the DB row URL omitted the query.
 */
export function buildProxyM3U8RequestUrl(
  publicUrl: string,
  dynamicM3U8Id?: number | null
): string {
  if (dynamicM3U8Id == null || publicUrl.length === 0) return publicUrl;
  if (!publicUrl.includes("proxy/m3u8")) return publicUrl;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://localhost";
    const u = new URL(publicUrl, base);
    if (u.searchParams.get("stream_id") != null) {
      return publicUrl;
    }
    u.searchParams.set("stream_id", String(dynamicM3U8Id));
    if (publicUrl.startsWith("http://") || publicUrl.startsWith("https://")) {
      return u.toString();
    }
    return u.pathname + u.search + u.hash;
  } catch {
    return publicUrl;
  }
}

/**
 * Primary playback URL is proxied through `/api/v1/proxy/stream?url=…`.
 * When the same channel is served as `/proxy/m3u8?…`, `stream_id` is appended
 * to that URL so manifest + segment requests keep DB header context.
 */
export type ProxyStreamOptions = {
  dynamicM3U8Id?: number | null;
  headerProfile?: string | null;
};

function isProxiedStreamUrl(url: string): boolean {
  return (
    (url.includes("/proxy/stream") || url.includes("/api/v1/proxy/stream")) &&
    url.includes("url=")
  );
}

/**
 * Segment / variant URLs rewritten by the backend may omit `header_profile` or
 * `stream_id`; re-attach them so geo-bypass headers stay on every HLS request.
 */
export function augmentProxiedStreamUrl(
  url: string,
  options?: ProxyStreamOptions
): string {
  if (!isProxiedStreamUrl(url)) return url;
  const id = options?.dynamicM3U8Id;
  const hp = options?.headerProfile?.trim();
  if (id == null && !hp) return url;
  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "https://localhost";
    const u = new URL(url, base);
    let changed = false;
    if (id != null && !u.searchParams.has("stream_id")) {
      u.searchParams.set("stream_id", String(id));
      changed = true;
    }
    if (hp && !u.searchParams.has("header_profile")) {
      u.searchParams.set("header_profile", hp);
      changed = true;
    }
    if (!changed) return url;
    if (url.startsWith("http://") || url.startsWith("https://")) return u.toString();
    return u.pathname + u.search + u.hash;
  } catch {
    return url;
  }
}

export function buildProxyStreamUrl(
  targetUrl: string,
  options?: ProxyStreamOptions
): string {
  let out = `${buildApiUrl("/proxy/stream")}?url=${encodeURIComponent(targetUrl)}`;
  const id = options?.dynamicM3U8Id;
  if (id != null) out += `&stream_id=${id}`;
  const hp = options?.headerProfile?.trim();
  if (hp) out += `&header_profile=${encodeURIComponent(hp)}`;
  return out;
}

/** Route every HLS XHR through the API proxy and preserve geo/header context. */
export function relayHlsStreamUrl(url: string, options?: ProxyStreamOptions): string {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return url;
  const id = options?.dynamicM3U8Id;
  const hp = options?.headerProfile?.trim() || undefined;
  const opt =
    id == null && !hp ? undefined : { dynamicM3U8Id: id, headerProfile: hp };
  if (isProxiedStreamUrl(url)) {
    return augmentProxiedStreamUrl(url, opt);
  }
  try {
    return buildProxyStreamUrl(url, opt);
  } catch {
    return url;
  }
}

/** Same-origin DRM license relay — POST challenge bytes via /api/v1/proxy/license. */
export function buildProxyLicenseUrl(
  licenseUrl: string,
  options?: ProxyStreamOptions
): string {
  let out = `${buildApiUrl("/proxy/license")}?url=${encodeURIComponent(licenseUrl)}`;
  const id = options?.dynamicM3U8Id;
  if (id != null) out += `&stream_id=${id}`;
  const hp = options?.headerProfile?.trim();
  if (hp) out += `&header_profile=${encodeURIComponent(hp)}`;
  return out;
}

/** True when the proxied URL targets an MPEG-DASH manifest (``.mpd``) — HLS.js cannot play these. */
export function isDashProxiedStreamUrl(proxiedUrl: string): boolean {
  if (!proxiedUrl.includes("proxy/stream") && !proxiedUrl.includes("proxy%2Fstream")) {
    return false;
  }
  try {
    const u = new URL(
      proxiedUrl,
      typeof window !== "undefined" ? window.location.origin : "https://localhost"
    );
    const inner = u.searchParams.get("url");
    if (!inner) return false;
    return inner.split("?")[0]!.toLowerCase().endsWith(".mpd");
  } catch {
    return false;
  }
}
