import type { PremiumDirectSportEntry } from "@/lib/types";

/**
 * Curated premium rows (multi-URL failover).
 * Dead entries removed: owrcovcrpy.gpcdn.net (DNS dead), byphdgllyk.gpcdn.net,
 * and IP-based servers (198.195.239.50, 103.162.136.235, 5.188.1.211,
 * 66.102.120.18, 41.205.93.154, 103.229.254.25, 103.175.73.12) — all timeout.
 */
export const PREMIUM_DIRECT_SPORTS: ReadonlyArray<PremiumDirectSportEntry> = [
  // ── India Sports ───────────────────────────────────────────────────────────
  {
    name: "Star Sports 1 HD",
    module: "india",
    category: "Sports",
    country: "India",
    geo_hint: true,
    header_profile: "star_sports",
    stream_urls: [
      "http://103.55.144.46/hls/stersports1hd.m3u8",
    ],
  },
  {
    name: "Star Sports 2 HD",
    module: "india",
    category: "Sports",
    country: "India",
    geo_hint: true,
    header_profile: "star_sports",
    stream_urls: [
      "http://103.55.144.46/hls/starsports2hd.m3u8",
    ],
  },
  {
    name: "Star Sports Select 1 HD",
    module: "india",
    category: "Sports",
    country: "India",
    geo_hint: true,
    header_profile: "star_sports",
    stream_urls: [
      "http://103.55.144.46/hls/starselect1hd.m3u8",
    ],
  },
  {
    name: "Star Sports 1 Hindi",
    module: "india",
    category: "Sports",
    country: "India",
    geo_hint: true,
    header_profile: "star_sports",
    stream_urls: [
      "http://103.55.144.46/hls/starsports1hindi.m3u8",
    ],
  },
  {
    name: "Sony Ten 2 HD",
    module: "india",
    category: "Sports",
    country: "India",
    geo_hint: true,
    header_profile: "sony_sports",
    stream_urls: [
      "http://103.55.144.46/hls/sonyten2.m3u8",
    ],
  },
  {
    name: "Sony Ten 3 HD",
    module: "india",
    category: "Sports",
    country: "India",
    geo_hint: true,
    header_profile: "sony_sports",
    stream_urls: [
      "http://103.55.144.46/hls/sonyten3.m3u8",
    ],
  },
  {
    name: "DD Sports 2.0",
    module: "india",
    category: "Sports",
    country: "India",
    stream_urls: [
      "https://d3qs3d2rkhfqrt.cloudfront.net/out/v1/b17adfe543354fdd8d189b110617cddd/index.m3u8",
    ],
  },

  // ── India Entertainment / News ─────────────────────────────────────────────
  {
    name: "ABP Ananda",
    module: "india",
    category: "News",
    country: "India",
    stream_urls: [
      "https://amg01448-samsungin-abpananda-samsungin-ad-pw.amagi.tv/playlist/amg01448-samsungin-abpananda-samsungin/playlist.m3u8",
    ],
  },
  {
    name: "TV9 Bangla",
    module: "india",
    category: "News",
    country: "India",
    stream_urls: [
      "https://amg01448-samsungin-tv9bangla-samsungin-9lgnh.amagi.tv/playlist/amg01448-samsungin-tv9bangla-samsungin/playlist.m3u8",
    ],
  },
  {
    name: "DD Bangla",
    module: "india",
    category: "Entertainment",
    country: "India",
    stream_urls: [
      "https://d3qs3d2rkhfqrt.cloudfront.net/out/v1/7ff57cc9046b4c188b51a0d506f36e7f/index_3.m3u8",
    ],
  },
  {
    name: "Zee 24 Ghanta",
    module: "india",
    category: "News",
    country: "India",
    stream_urls: ["https://d2dsoyvkr33m05.cloudfront.net/index_1.m3u8"],
  },
  {
    name: "Kolkata TV",
    module: "india",
    category: "News",
    country: "India",
    stream_urls: ["https://cdn.ottlive.co.in/kolkatatv/index.m3u8"],
  },

  // ── FAST / Free Ad-Supported TV ────────────────────────────────────────────
  {
    name: "Red Bull TV",
    module: "fast_tv",
    category: "Sports",
    country: "Global",
    stream_urls: ["https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master_3360.m3u8"],
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Redbull_TV_logo.svg/200px-Redbull_TV_logo.svg.png",
  },

  // ── World Cup 2026 ─────────────────────────────────────────────────────────
  {
    name: "Star Sports 1 HD",
    module: "world_cup_2026",
    category: "Sports",
    country: "India",
    geo_hint: true,
    header_profile: "star_sports",
    stream_urls: [
      "http://103.55.144.46/hls/stersports1hd.m3u8",
    ],
  },
  {
    name: "Star Sports 2 HD",
    module: "world_cup_2026",
    category: "Sports",
    country: "India",
    geo_hint: true,
    header_profile: "star_sports",
    stream_urls: [
      "http://103.55.144.46/hls/starsports2hd.m3u8",
    ],
  },
  {
    name: "Sony Ten 2 HD",
    module: "world_cup_2026",
    category: "Sports",
    country: "India",
    geo_hint: true,
    header_profile: "sony_sports",
    stream_urls: [
      "http://103.55.144.46/hls/sonyten2.m3u8",
    ],
  },
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

  // ── Bangladesh Diaspora / Reliable Streams ─────────────────────────────────
  {
    name: "Enter 10 Bangla",
    module: "bangladesh_and_bdix",
    category: "Entertainment",
    country: "India",
    stream_urls: [
      "https://amg01448-samsungin-enterr10bangla-samsungin-ad-gg.amagi.tv/playlist/amg01448-samsungin-enterr10bangla-samsungin/playlist.m3u8",
    ],
  },
  {
    name: "News18 Bangla",
    module: "bangladesh_and_bdix",
    category: "News",
    country: "India",
    stream_urls: ["https://amg01448-samsungin-news18bangla-samsungin-ad-qy.amagi.tv/playlist/amg01448-samsungin-news18bangla-samsungin/playlist.m3u8"],
  },
  {
    name: "ATN Bangla UK",
    module: "bangladesh_and_bdix",
    category: "Entertainment",
    country: "UK",
    stream_urls: ["https://app.ncare.live/live-orgin/atnbanglauk-off.stream/playlist.m3u8"],
  },
  {
    name: "NTV UK",
    module: "bangladesh_and_bdix",
    category: "Entertainment",
    country: "UK",
    stream_urls: ["https://app.ncare.live/c3VydmVyX8RpbEU9Mi8xNy8yMDE0GIDU6RgzQ6NTAgdEoaeFzbF92YWxIZTO0U0ezN1IzMyfvcGVMZEJCTEFWeVN3PTOmdFsaWRtaW51aiPhnPTI2/ntvuk00332211.stream/playlist.m3u8"],
  },
];

/**
 * Viewer catalog sources.
 *
 * - M3U URLs: fetched via /api/v1/proxy/playlist (Render backend).
 * - premium_direct_sports: direct HLS streams (no proxy needed).
 * - BDIX M3U playlists supply all BD channels (since gpcdn.net CDN is dead).
 */
export const APP_STREAM_CONFIG = {
  // Sports M3U playlists — filtered to football/cricket by streamCatalog.
  // index.m3u removed (10k+ channels → timeout). Use category-specific playlists.
  dynamic_master_playlists: [
    // iptv-org sports category (football, cricket, tennis, etc.)
    "https://iptv-org.github.io/iptv/categories/sports.m3u",
    // SM-Live-TV combined (hourly update) — BD+India sports channels
    "https://raw.githubusercontent.com/sm-monirulislam/SM-Live-TV/refs/heads/main/Combined_Live_TV.m3u",
    // Free-TV HD (daily update, free-to-air sports)
    "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
    // World IP TV (6h update, auto-verified working channels)
    "https://romaxa55.github.io/world_ip_tv/output/index.m3u",
    // LegalStream — FIFA/WC coverage, US sports
    "https://raw.githubusercontent.com/notanewbie/LegalStream/master/packages/sports/live.m3u8",
  ],

  country_playlists: {
    bangladesh_and_bdix: [
      // iptv-org Bangladesh + Bengali language
      "https://iptv-org.github.io/iptv/countries/bd.m3u",
      "https://iptv-org.github.io/iptv/languages/ben.m3u",
      // BDIX community M3U sources (Bangladesh ISP-local, low latency)
      "https://raw.githubusercontent.com/Shadmanislam/bdiptv/master/BD%20IPTV.m3u",
      "https://raw.githubusercontent.com/abusaeeidx/Mrgify-BDIX-IPTV/main/playlist.m3u",
      "https://raw.githubusercontent.com/imShakil/tvlink/refs/heads/main/iptv.m3u8",
      // SM-Live-TV: BD + India channels (hourly update)
      "https://raw.githubusercontent.com/sm-monirulislam/SM-Live-TV/refs/heads/main/Combined_Live_TV.m3u",
      // T Sports — Bangladesh premium sports channel
      "https://raw.githubusercontent.com/Gtajisan/iptv-TSports/main/NS_Player_Tsports_live.m3u",
      "https://raw.githubusercontent.com/Gtajisan/iptv-TSports/main/OTT_Navigator_Tspots_live.m3u",
    ],
    india: [
      "https://iptv-org.github.io/iptv/countries/in.m3u",
      "https://iptv-org.github.io/iptv/languages/hin.m3u",
      "https://iptv-org.github.io/iptv/languages/tam.m3u",
      "https://iptv-org.github.io/iptv/languages/tel.m3u",
      "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
    ],
  },

  fast_tv_sources: {
    samsung_tv_plus: "https://apsattv.com/ssungusa.m3u",
    pluto_tv: "https://i.mjh.nz/PlutoTV/all.m3u8",
    plex_tv: "https://i.mjh.nz/Plex/all.m3u8",
  },

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
