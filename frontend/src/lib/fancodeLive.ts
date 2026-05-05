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

const LIVE_MATCH_DEFAULT_LIMIT = 5;

function isFootballOrCricketMatch(match: FanCodeMatch): boolean {
  const hay = [
    match.event_catagory,
    match.event_name,
    match.match_name,
    match.team_1,
    match.team_2,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const footballKeywords = [
    "football",
    "soccer",
    "futbol",
    "premier league",
    "laliga",
    "la liga",
    "champions league",
    "serie a",
    "bundesliga",
    "ligue 1",
    "uefa",
    "fifa",
    "copa",
  ];
  const cricketKeywords = [
    "cricket",
    "ipl",
    "icc",
    "bpl",
    "psl",
    "t20",
    "odi",
    "test match",
  ];
  return [...footballKeywords, ...cricketKeywords].some((k) => hay.includes(k));
}

function isLikelyLive(match: FanCodeMatch): boolean {
  const hay = [match.event_catagory, match.event_name, match.match_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return ["live", "ongoing", "watch now", "stream"].some((k) => hay.includes(k));
}

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
  const rows = matches
    .filter((m) => m.stream_link && String(m.stream_link).startsWith("http"))
    .filter((m) => isFootballOrCricketMatch(m))
    .sort((a, b) => Number(isLikelyLive(b)) - Number(isLikelyLive(a)))
    .slice(0, LIVE_MATCH_DEFAULT_LIMIT)
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

  const dedup = new Set<string>();
  return rows.filter((r) => {
    const key = r.stream_url.trim();
    if (dedup.has(key)) return false;
    dedup.add(key);
    return true;
  });
}
