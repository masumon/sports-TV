import type { VpnMode } from "@/store/vpnStore";

/**
 * Heuristics: channels that often play more reliably when routed via our
 * server relay (CORS / token / region hints in metadata — not a real OS VPN).
 */
export function channelSuggestsServerRelay(c: { name: string; category: string; stream_url: string }): boolean {
  const bundle = `${c.name}\n${c.category}\n${c.stream_url}`.toLowerCase();
  if (/geo[-\s]?block|geo[-\s]?locked|only\s*uk|only\s*us|only\s*in|not\s*in\s*eu|restricted|drm|nbc\s*olym|peacock/i.test(bundle)) {
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
