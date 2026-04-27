import type { Channel } from "@/lib/types";
import { APP_STREAM_CONFIG } from "@/lib/appStreamConfig";

type FanCodeMatch = {
  event_catagory?: string;
  event_name?: string;
  match_id?: number;
  match_name?: string;
  team_1?: string;
  team_2?: string;
  team_1_flag?: string;
  team_2_flag?: string;
  banner?: string;
  stream_link?: string;
};

type FanCodeJson = {
  matches?: FanCodeMatch[];
};

function stableId(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i);
    h |= 0;
  }
  return h === 0 ? -1 : h;
}

/**
 * FanCode JSON is loaded with a direct GET (raw.githubusercontent.com allows browser CORS).
 * Playback still goes through /proxy/stream from PremiumPlayer.
 */
const FANCODE_FETCH_TIMEOUT_MS = 20_000;

export async function fetchFanCodeLiveChannels(): Promise<Channel[]> {
  const url = APP_STREAM_CONFIG.secured_endpoints.fancode_live_json;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FANCODE_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) throw new Error(`FanCode JSON failed (${res.status})`);
  const data = (await res.json()) as FanCodeJson;
  const matches = Array.isArray(data.matches) ? data.matches : [];
  const emptyTs = { created_at: "", updated_at: "" };
  return matches
    .filter((m) => m.stream_link && String(m.stream_link).startsWith("http"))
    .map((m) => {
      const title = m.match_name?.trim() || "Live match";
      const cat = (m.event_catagory || "live").toLowerCase();
      const logo =
        m.banner?.trim() ||
        m.team_1_flag?.trim() ||
        m.team_2_flag?.trim() ||
        null;
      return {
        id: stableId(`fancode-${m.match_id ?? title}-${m.stream_link}`),
        name: title,
        country: "India",
        category: cat,
        language: "en",
        logo_url: logo,
        stream_url: String(m.stream_link),
        alternate_urls: [],
        quality_tag: "live",
        module: "live_matches",
        is_active: true,
        geo_hint: true,
        header_profile: null,
        ...emptyTs,
      } satisfies Channel;
    });
}
