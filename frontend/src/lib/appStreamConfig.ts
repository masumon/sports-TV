import type { PremiumDirectSportEntry } from "@/lib/types";

/** Add direct HLS rows here; each `module` selects the home tab. */
export const PREMIUM_DIRECT_SPORTS: ReadonlyArray<PremiumDirectSportEntry> = [];

/**
 * Viewer catalog sources.
 *
 * - All M3U URLs: fetched only via GET /api/v1/proxy/playlist (Redis-cached on backend).
 * - FanCode JSON: direct browser GET to fancode_live_json.
 * - premium_direct_sports: direct stream URLs merged into tabs by `module` (no playlist fetch).
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
    lg_channels: "https://www.apsattv.com/lg.m3u",
  },

  secured_endpoints: {
    fancode_live_json:
      "https://raw.githubusercontent.com/byte-capsule/FanCode-Hls-Fetcher/main/Fancode_hls_m3u8.Json",
  },

  /**
   * Curated direct HLS/stream URLs, routed by `module` to the matching tab.
   * Edit `PREMIUM_DIRECT_SPORTS` above; duplicates (same stream URL) are de-duped against playlist rows.
   */
  premium_direct_sports: PREMIUM_DIRECT_SPORTS,
};
