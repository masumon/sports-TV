import type { PremiumDirectSportEntry } from "@/lib/types";

/**
 * Curated premium rows (multi-URL failover). Entries with no usable `stream_urls` are omitted.
 * `bangladesh_and_bdix` maps to the Bangladesh viewer tab.
 */
export const PREMIUM_DIRECT_SPORTS: ReadonlyArray<PremiumDirectSportEntry> = [
  {
    name: "Sky Sports F1 4K",
    module: "global_sports",
    stream_urls: ["https://xemzi.short.gy/2000016"],
  },
  {
    name: "Sony Ten 1 HD",
    module: "india",
    stream_urls: [
      "http://103.162.136.235:4500/play/a018/index.m3u8",
      "http://66.102.120.18:8000/play/a00e/index.m3u8",
    ],
  },
  {
    name: "Sony Ten 2 HD",
    module: "india",
    stream_urls: [
      "http://103.162.136.235:4500/play/a00o/index.m3u8",
      "http://103.229.254.25:7001/play/a02t/index.m3u8",
      "http://103.55.144.46/hls/sonyten2.m3u8",
    ],
  },
  {
    name: "Star Sports 1 HD",
    module: "india",
    stream_urls: [
      "http://103.162.136.235:4500/play/a01f/index.m3u8",
      "http://103.55.144.46/hls/stersports1hd.m3u8",
    ],
  },
  {
    name: "PTV Sports",
    module: "global_sports",
    stream_urls: ["https://tvsen5.aynaott.com/Ptvsports/index.m3u8"],
  },
];

/**
 * Viewer catalog sources.
 *
 * - M3U URLs: GET /api/v1/proxy/playlist (HLS manifests rewritten to proxied segments when applicable).
 * - FanCode JSON: direct browser GET to fancode_live_json.
 * - premium_direct_sports: direct stream URLs merged into tabs (`stream_urls` = failover chain).
 */
export const APP_STREAM_CONFIG = {
  dynamic_master_playlists: [
    "https://iptv-org.github.io/iptv/index.m3u",
    "https://iptv-org.github.io/iptv/categories/sport.m3u",
  ],

  country_playlists: {
    bangladesh_and_bdix: [
      "https://iptv-org.github.io/iptv/countries/bd.m3u",
      "https://iptv-org.github.io/iptv/languages/ben.m3u",
    ],
    india: [
      "https://iptv-org.github.io/iptv/countries/in.m3u",
      "https://iptv-org.github.io/iptv/languages/hin.m3u",
      "https://iptv-org.github.io/iptv/languages/tam.m3u",
      "https://iptv-org.github.io/iptv/languages/tel.m3u",
    ],
  },

  fast_tv_sources: {
    samsung_tv_plus: "https://apsattv.com/ssungusa.m3u",
    pluto_tv: "https://i.mjh.nz/PlutoTV/all.m3u8",
  },

  secured_endpoints: {
    fancode_live_json:
      "https://raw.githubusercontent.com/byte-capsule/FanCode-Hls-Fetcher/main/Fancode_hls_m3u8.Json",
  },

  premium_direct_sports: PREMIUM_DIRECT_SPORTS,
};
