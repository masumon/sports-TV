import { buildApiUrl } from "@/lib/apiClient";
import type { VpnMode } from "@/store/vpnStore";

/**
 * Heuristics: channels that often play more reliably when routed via our
 * server relay (CORS / token / region hints in metadata — not a real OS VPN).
 */
export function channelSuggestsServerRelay(c: { name: string; category: string; stream_url: string }): boolean {
  const bundle = `${c.name}\n${c.category}\n${c.stream_url}`.toLowerCase();
  if (/bangladesh|bangla|bengali|dhaka|\.bd\b|geo[-\s]?block|geo[-\s]?locked|only\s*uk|only\s*us|only\s*in|not\s*in\s*eu|restricted|drm|nbc\s*olym|peacock/i.test(bundle)) {
    return true;
  }
  if (/[?&](?:token|key|auth|exp|hdnea|m3u8_token)=[^&]{8,}/i.test(c.stream_url)) {
    return true;
  }
  if (c.stream_url.length > 200 && c.stream_url.includes("?")) {
    return true;
  }
  return false;
}

/** When true, HLS should try the backend proxy URL before direct origin URLs. */
export function shouldPreferServerRelay(
  mode: VpnMode,
  channel: { name: string; category: string; stream_url: string } | null | undefined
): boolean {
  if (mode === "on") return true;
  if (!channel) return false;
  return channelSuggestsServerRelay(channel);
}

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
export function buildProxyStreamUrl(
  targetUrl: string,
  options?: { dynamicM3U8Id?: number | null }
): string {
  const base = `${buildApiUrl("/proxy/stream")}?url=${encodeURIComponent(targetUrl)}`;
  const id = options?.dynamicM3U8Id;
  if (id == null) return base;
  return `${base}&stream_id=${id}`;
}
