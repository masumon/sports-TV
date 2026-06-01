import type { PremiumDirectSportEntry } from "@/lib/types";

/**
 * Curated premium rows (multi-URL failover). Entries with no usable `stream_urls` are omitted.
 * `bangladesh_and_bdix` maps to the Bangladesh viewer tab.
 */
export const PREMIUM_DIRECT_SPORTS: ReadonlyArray<PremiumDirectSportEntry> = [
  // ── India ──────────────────────────────────────────────────────────────────
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

  // ── Global Sports ──────────────────────────────────────────────────────────
  {
    name: "Sky Sports F1 4K",
    module: "global_sports",
    category: "Sports",
    stream_urls: ["https://xemzi.short.gy/2000016"],
  },
  {
    name: "PTV Sports",
    module: "global_sports",
    category: "Sports",
    stream_urls: ["https://tvsen5.aynaott.com/Ptvsports/index.m3u8"],
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
    stream_urls: [
      "http://41.205.93.154/STARSPORTS1/index.m3u8",
      "http://103.162.136.235:4500/play/a01f/index.m3u8",
      "http://103.55.144.46/hls/stersports1hd.m3u8",
    ],
  },
  {
    name: "Sony Sports 5",
    module: "world_cup_2026",
    category: "Sports",
    country: "India",
    stream_urls: [
      "http://198.195.239.50:8095/SonyTenSports5/tracks-v1a1/mono.m3u8",
      "http://103.162.136.235:4500/play/a018/index.m3u8",
    ],
  },
  {
    name: "Sony Ten 1 HD",
    module: "world_cup_2026",
    category: "Sports",
    country: "India",
    stream_urls: [
      "http://103.162.136.235:4500/play/a018/index.m3u8",
      "http://66.102.120.18:8000/play/a00e/index.m3u8",
    ],
  },
  {
    name: "Sony Ten 2 HD",
    module: "world_cup_2026",
    category: "Sports",
    country: "India",
    stream_urls: [
      "http://103.162.136.235:4500/play/a00o/index.m3u8",
      "http://103.229.254.25:7001/play/a02t/index.m3u8",
    ],
  },
  {
    name: "DD Sports 2.0",
    module: "world_cup_2026",
    category: "Sports",
    country: "India",
    stream_urls: [
      "https://d3qs3d2rkhfqrt.cloudfront.net/out/v1/b17adfe543354fdd8d189b110617cddd/index.m3u8",
      "http://103.175.73.12:8080/live/64/64_0.m3u8",
    ],
  },
  {
    name: "Aljazeera",
    module: "world_cup_2026",
    category: "News",
    country: "Qatar",
    stream_urls: ["https://owrcovcrpy.gpcdn.net/bpk-tv/1721/output/index.m3u8"],
  },
  {
    name: "Eurosport",
    module: "world_cup_2026",
    category: "Sports",
    country: "Global",
    stream_urls: ["http://198.195.239.50:8095/Eurosport/index.m3u8"],
  },
  {
    name: "BBC News",
    module: "world_cup_2026",
    category: "News",
    country: "UK",
    stream_urls: ["https://ythls.armelin.one/channel/UCelk6aHijZq-GJBBB9YpReA.m3u8"],
  },
  {
    name: "DW News",
    module: "world_cup_2026",
    category: "News",
    country: "Germany",
    stream_urls: [
      "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/stream02/streamPlaylist.m3u8",
      "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8",
    ],
  },
  {
    name: "NDTV English",
    module: "world_cup_2026",
    category: "News",
    country: "India",
    stream_urls: ["https://ndtv24x7elemarchana.akamaized.net/hls/live/2003678/ndtv24x7/master.m3u8"],
  },
  {
    name: "Sky Sports F1",
    module: "world_cup_2026",
    category: "Sports",
    country: "UK",
    stream_urls: ["https://xemzi.short.gy/2000016"],
  },

  // ── Bangladesh (from M3U) ──────────────────────────────────────────────────
  {
    name: "BTV",
    module: "bangladesh_and_bdix",
    category: "General",
    country: "Bangladesh",
    stream_urls: ["https://owrcovcrpy.gpcdn.net/bpk-tv/1709/output/index.m3u8"],
  },
  {
    name: "Somoy TV",
    module: "bangladesh_and_bdix",
    category: "News",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1702/output/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1702/output/1702.m3u8",
    ],
  },
  {
    name: "Ekattor TV",
    module: "bangladesh_and_bdix",
    category: "News",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1705/output/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1705/output/1705.m3u8",
    ],
  },
  {
    name: "Channel 24",
    module: "bangladesh_and_bdix",
    category: "News",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1703/output/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1703/output/1703.m3u8",
    ],
  },
  {
    name: "Independent TV",
    module: "bangladesh_and_bdix",
    category: "News",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1704/output/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1704/output/1704.m3u8",
    ],
  },
  {
    name: "Jamuna TV",
    module: "bangladesh_and_bdix",
    category: "News",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1701/output/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1701/output/1701-audio_113312_eng=113200-video=1692000.m3u8",
    ],
  },
  {
    name: "ATN News",
    module: "bangladesh_and_bdix",
    category: "News",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1706/output/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1706/output/1706.m3u8",
    ],
  },
  {
    name: "ATN Bangla",
    module: "bangladesh_and_bdix",
    category: "Entertainment",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1722/output/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1722/output/1722.m3u8",
    ],
  },
  {
    name: "NTV",
    module: "bangladesh_and_bdix",
    category: "Entertainment",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1716/output/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1716/output/1716.m3u8",
    ],
  },
  {
    name: "BanglaVision",
    module: "bangladesh_and_bdix",
    category: "Entertainment",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1715/output/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1715/output/1715.m3u8",
    ],
  },
  {
    name: "Channel I",
    module: "bangladesh_and_bdix",
    category: "Entertainment",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1723/output/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1723/output/1723.m3u8",
    ],
  },
  {
    name: "Deepto TV",
    module: "bangladesh_and_bdix",
    category: "Entertainment",
    country: "Bangladesh",
    stream_urls: [
      "https://byphdgllyk.gpcdn.net/hls/deeptotv/0_1/index.m3u8",
      "https://byphdgllyk.gpcdn.net/hls/deeptotv/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1711/output/index.m3u8",
    ],
  },
  {
    name: "SATV",
    module: "bangladesh_and_bdix",
    category: "Entertainment",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1720/output/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1720/output/1720.m3u8",
    ],
  },
  {
    name: "Channel 9",
    module: "bangladesh_and_bdix",
    category: "Entertainment",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1729/output/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1729/output/1729.m3u8",
    ],
  },
  {
    name: "News 24 BD",
    module: "bangladesh_and_bdix",
    category: "News",
    country: "Bangladesh",
    stream_urls: ["https://owrcovcrpy.gpcdn.net/bpk-tv/1708/output/index.m3u8"],
  },
  {
    name: "DBC News",
    module: "bangladesh_and_bdix",
    category: "News",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1728/output/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1728/output/1728.m3u8",
    ],
  },
  {
    name: "Nagorik TV",
    module: "bangladesh_and_bdix",
    category: "News",
    country: "Bangladesh",
    stream_urls: ["http://198.195.239.50:8095/nagorik/tracks-v1a1/mono.m3u8"],
  },
  {
    name: "Ekhon TV",
    module: "bangladesh_and_bdix",
    category: "News",
    country: "Bangladesh",
    stream_urls: ["https://owrcovcrpy.gpcdn.net/bpk-tv/1713/output/index.m3u8"],
  },
  {
    name: "Star News BD",
    module: "bangladesh_and_bdix",
    category: "News",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1710/output/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1710/output/1701.m3u8",
    ],
  },
  {
    name: "Islamic TV BD",
    module: "bangladesh_and_bdix",
    category: "Religious",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1724/output/1724.m3u8",
    ],
  },
  {
    name: "ATN Music",
    module: "bangladesh_and_bdix",
    category: "Music",
    country: "Bangladesh",
    stream_urls: ["https://owrcovcrpy.gpcdn.net/bpk-tv/1717/output/index.m3u8"],
  },
  {
    name: "Maasranga TV",
    module: "bangladesh_and_bdix",
    category: "Entertainment",
    country: "Bangladesh",
    stream_urls: ["https://owrcovcrpy.gpcdn.net/bpk-tv/1722/output/1722.m3u8"],
  },
  {
    name: "Saudi Quran",
    module: "bangladesh_and_bdix",
    category: "Religious",
    country: "Saudi Arabia",
    stream_urls: ["https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8"],
  },
  {
    name: "Madina Live",
    module: "bangladesh_and_bdix",
    category: "Religious",
    country: "Saudi Arabia",
    stream_urls: ["https://cdn-globecast.akamaized.net/live/eds/saudi_sunnah/hls_roku/index.m3u8"],
  },
  {
    name: "Enter 10 Bangla",
    module: "bangladesh_and_bdix",
    category: "Entertainment",
    country: "India",
    stream_urls: [
      "https://amg01448-samsungin-enterr10bangla-samsungin-ad-gg.amagi.tv/playlist/amg01448-samsungin-enterr10bangla-samsungin/playlist.m3u8",
      "https://live-bangla.akamaized.net/liveabr/pub-iobanglakp3sff/live_720p/chunks.m3u8",
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
  {
    name: "Gazi TV",
    module: "bangladesh_and_bdix",
    category: "Entertainment",
    country: "Bangladesh",
    stream_urls: [
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1718/output/index.m3u8",
      "https://owrcovcrpy.gpcdn.net/bpk-tv/1718/output/1718.m3u8",
    ],
  },

  // ── India (from M3U) ───────────────────────────────────────────────────────
  {
    name: "ABP Ananda",
    module: "india",
    category: "News",
    country: "India",
    stream_urls: [
      "https://amg01448-samsungin-abpananda-samsungin-ad-pw.amagi.tv/playlist/amg01448-samsungin-abpananda-samsungin/playlist.m3u8",
      "http://103.175.73.12:8080/live/200/200_0.m3u8",
    ],
  },
  {
    name: "TV9 Bangla",
    module: "india",
    category: "News",
    country: "India",
    stream_urls: [
      "https://amg01448-samsungin-tv9bangla-samsungin-9lgnh.amagi.tv/playlist/amg01448-samsungin-tv9bangla-samsungin/playlist.m3u8",
      "http://103.175.73.12:8080/live/201/201_0.m3u8",
    ],
  },
  {
    name: "DD Bangla",
    module: "india",
    category: "Entertainment",
    country: "India",
    stream_urls: ["https://d3qs3d2rkhfqrt.cloudfront.net/out/v1/7ff57cc9046b4c188b51a0d506f36e7f/index_3.m3u8"],
  },
  {
    name: "Sony Aath",
    module: "india",
    category: "Entertainment",
    country: "India",
    stream_urls: ["http://198.195.239.50:8095/SonyAath/tracks-v1a1/mono.m3u8"],
  },
  {
    name: "Jalsha Movies",
    module: "india",
    category: "Movies",
    country: "India",
    stream_urls: ["http://198.195.239.50:8095/JalshaMovies/tracks-v1a1/mono.m3u8"],
  },
  {
    name: "Colors Bangla Cinema",
    module: "india",
    category: "Movies",
    country: "India",
    stream_urls: ["http://198.195.239.50:8095/ColorsBanglaChinema/tracks-v1a1/mono.m3u8"],
  },
  {
    name: "Sony TV HD",
    module: "india",
    category: "Entertainment",
    country: "India",
    stream_urls: ["http://198.195.239.50:8095/SonyTv/tracks-v1a1/mono.m3u8"],
  },
  {
    name: "Star Movies",
    module: "india",
    category: "Movies",
    country: "India",
    stream_urls: ["http://198.195.239.50:8095/StarMovies/tracks-v1a1/mono.m3u8"],
  },
  {
    name: "DD Sports 2.0",
    module: "india",
    category: "Sports",
    country: "India",
    stream_urls: [
      "https://d3qs3d2rkhfqrt.cloudfront.net/out/v1/b17adfe543354fdd8d189b110617cddd/index.m3u8",
      "http://103.175.73.12:8080/live/64/64_0.m3u8",
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
];

/**
 * Viewer catalog sources.
 *
 * - M3U URLs: GET /api/v1/proxy/playlist (HLS manifests rewritten to proxied segments when applicable).
 * - FanCode JSON: direct browser GET to fancode_live_json.
 * - premium_direct_sports: direct stream URLs merged into tabs (`stream_urls` = failover chain).
 * - BDIX sources (Bangladesh ISP network) are included in bangladesh_and_bdix for low-latency BD streams.
 */
export const APP_STREAM_CONFIG = {
  dynamic_master_playlists: [
    "https://iptv-org.github.io/iptv/index.m3u",
    "https://iptv-org.github.io/iptv/categories/sports.m3u",
    "https://iptv-org.github.io/iptv/categories/sport.m3u",
  ],

  country_playlists: {
    bangladesh_and_bdix: [
      "https://iptv-org.github.io/iptv/countries/bd.m3u",
      "https://iptv-org.github.io/iptv/languages/ben.m3u",
      // BDIX community M3U sources (Bangladesh ISP-local, low latency)
      "https://raw.githubusercontent.com/Shadmanislam/bdiptv/master/BD%20IPTV.m3u",
      "https://github.com/abusaeeidx/Mrgify-BDIX-IPTV/raw/main/playlist.m3u",
      "https://raw.githubusercontent.com/imShakil/tvlink/refs/heads/main/iptv.m3u8",
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
    plex_tv: "https://i.mjh.nz/Plex/all.m3u8",
  },

  secured_endpoints: {
    fancode_live_json:
      "https://raw.githubusercontent.com/byte-capsule/FanCode-Hls-Fetcher/main/Fancode_hls_m3u8.Json",
  },

  premium_direct_sports: PREMIUM_DIRECT_SPORTS,
};
