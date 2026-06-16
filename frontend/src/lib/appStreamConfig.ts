import type { PremiumDirectSportEntry } from "@/lib/types";

/**
 * Premium direct streams (geo-free or header-bypass).
 * Removed: 103.55.144.46 entries (Star Sports/Sony Ten) — TCP-layer geo-blocked
 * from Render US; no header trick bypasses CDN TCP check.
 * ISP-blocked channels (BD) are already bypassed via Render proxy architecture.
 */
export const PREMIUM_DIRECT_SPORTS: ReadonlyArray<PremiumDirectSportEntry> = [
  // ── World Cup 2026 ─────────────────────────────────────────────────────────
  {
    name: "DD Sports 2.0",
    module: "world_cup_2026",
    category: "Sports",
    country: "India",
    stream_urls: [
      "https://d3qs3d2rkhfqrt.cloudfront.net/out/v1/b17adfe543354fdd8d189b110617cddd/index.m3u8",
    ],
  },
  {
    name: "Al Jazeera English",
    module: "world_cup_2026",
    category: "News",
    country: "Qatar",
    stream_urls: ["https://live-hls-web-aje.getaj.net/AJE/index.m3u8"],
  },
  {
    name: "DW News",
    module: "world_cup_2026",
    category: "News",
    country: "Germany",
    stream_urls: [
      "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/stream02/streamPlaylist.m3u8",
    ],
  },
  {
    name: "NDTV English",
    module: "world_cup_2026",
    category: "News",
    country: "India",
    stream_urls: ["https://ndtv24x7elemarchana.akamaized.net/hls/live/2003678/ndtv24x7/master.m3u8"],
  },

  // ── Global Sports ──────────────────────────────────────────────────────────
  {
    name: "Red Bull TV",
    module: "global_sports",
    category: "Sports",
    country: "Global",
    stream_urls: ["https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master_3360.m3u8"],
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Redbull_TV_logo.svg/200px-Redbull_TV_logo.svg.png",
  },
  {
    name: "ABP Ananda",
    module: "global_sports",
    category: "News",
    country: "India",
    stream_urls: [
      "https://amg01448-samsungin-abpananda-samsungin-ad-pw.amagi.tv/playlist/amg01448-samsungin-abpananda-samsungin/playlist.m3u8",
    ],
  },
  {
    name: "TV9 Bangla",
    module: "global_sports",
    category: "News",
    country: "India",
    stream_urls: [
      "https://amg01448-samsungin-tv9bangla-samsungin-9lgnh.amagi.tv/playlist/amg01448-samsungin-tv9bangla-samsungin/playlist.m3u8",
    ],
  },
  {
    name: "DD Bangla",
    module: "global_sports",
    category: "Entertainment",
    country: "India",
    stream_urls: [
      "https://d3qs3d2rkhfqrt.cloudfront.net/out/v1/7ff57cc9046b4c188b51a0d506f36e7f/index_3.m3u8",
    ],
  },
  {
    name: "Zee 24 Ghanta",
    module: "global_sports",
    category: "News",
    country: "India",
    stream_urls: ["https://d2dsoyvkr33m05.cloudfront.net/index_1.m3u8"],
  },
  {
    name: "Enter 10 Bangla",
    module: "global_sports",
    category: "Entertainment",
    country: "India",
    stream_urls: [
      "https://amg01448-samsungin-enterr10bangla-samsungin-ad-gg.amagi.tv/playlist/amg01448-samsungin-enterr10bangla-samsungin/playlist.m3u8",
    ],
  },
  {
    name: "News18 Bangla",
    module: "global_sports",
    category: "News",
    country: "India",
    stream_urls: ["https://amg01448-samsungin-news18bangla-samsungin-ad-qy.amagi.tv/playlist/amg01448-samsungin-news18bangla-samsungin/playlist.m3u8"],
  },
  {
    name: "ATN Bangla UK",
    module: "global_sports",
    category: "Entertainment",
    country: "UK",
    stream_urls: ["https://app.ncare.live/live-orgin/atnbanglauk-off.stream/playlist.m3u8"],
  },
  {
    name: "NTV UK",
    module: "global_sports",
    category: "Entertainment",
    country: "UK",
    stream_urls: ["https://app.ncare.live/c3VydmVyX8RpbEU9Mi8xNy8yMDE0GIDU6RgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcGVMZEJCTEFWeVN3PTOmdFsaWRtaW51aiPhnPTI2/ntvuk00332211.stream/playlist.m3u8"],
  },
];

/**
 * 3-module stream config:
 *   world_cup_2026  — WC broadcast channels + T Sports + LegalStream
 *   live_matches    — FanCode live JSON/M3U + CricHD
 *   global_sports   — Sports.m3u, BD/Bengali, Pluto/Plex (football/cricket filtered)
 *
 * Removed duplicates:
 *   SM-Live-TV was in both dynamic_master + bangladesh → kept once in global_sports
 *   Free-TV was in both dynamic_master + india → kept once in global_sports
 *   OTT_Navigator_Tsports (duplicate of NS_Player) → removed
 * Removed dead/unreachable:
 *   abusaeeidx/Mrgify-BDIX-IPTV (BDIX-local, unreachable from Render US)
 *   imShakil/tvlink, Shadmanislam/bdiptv (unverified, stale)
 *   romaxa55/world_ip_tv (unverified)
 *   apsattv.com (unofficial Samsung scrape)
 *   iptv-org Hindi/Tamil/Telugu language playlists (sports filter makes them redundant)
 */
export const APP_STREAM_CONFIG = {
  // World Cup specific playlists → world_cup_2026 module (no football/cricket filter)
  world_cup_playlists: [
    // LegalStream — FIFA/WC live coverage
    "https://raw.githubusercontent.com/notanewbie/LegalStream/master/packages/sports/live.m3u8",
    // T Sports — Bangladesh WC 2026 broadcaster
    "https://raw.githubusercontent.com/Gtajisan/iptv-TSports/main/NS_Player_Tsports_live.m3u",
  ],

  // Global sports playlists → global_sports module (football/cricket keyword filter applied)
  global_sports_playlists: [
    // iptv-org sports category (daily verified, largest curated sports list)
    "https://iptv-org.github.io/iptv/categories/sports.m3u",
    // SM-Live-TV BD+India sports (hourly update)
    "https://raw.githubusercontent.com/sm-monirulislam/SM-Live-TV/refs/heads/main/Combined_Live_TV.m3u",
    // Free-TV free-to-air sports (daily update)
    "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
    // iptv-org Bangladesh channels (T Sports, BTV Sports etc)
    "https://iptv-org.github.io/iptv/countries/bd.m3u",
    // iptv-org Bengali language channels
    "https://iptv-org.github.io/iptv/languages/ben.m3u",
    // Pluto TV — free ad-supported sports channels
    "https://i.mjh.nz/PlutoTV/all.m3u8",
    // Plex TV — free ad-supported sports channels
    "https://i.mjh.nz/Plex/all.m3u8",
  ],

  // Live match sources (FanCode + CricHD) → live_matches module
  secured_endpoints: {
    fancode_live_json:
      "https://raw.githubusercontent.com/byte-capsule/FanCode-Hls-Fetcher/main/Fancode_hls_m3u8.Json",
    fancode_m3u:
      "https://raw.githubusercontent.com/kajju027/Fancode-Events-Json/main/fancode.m3u",
    crichd_m3u:
      "https://raw.githubusercontent.com/sm-monirulislam/CricHD-Auto-Update-Playlist/main/crichd.m3u",
  },

  premium_direct_sports: PREMIUM_DIRECT_SPORTS,
};
