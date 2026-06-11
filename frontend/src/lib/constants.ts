import { BRAND } from "./branding";

/** App metadata for drawer/footer */
export const APP_META = {
  version: "1.0.0",
  build: typeof process !== "undefined" && process.env.NEXT_PUBLIC_BUILD_ID
    ? process.env.NEXT_PUBLIC_BUILD_ID
    : "2026.06",
  developer: BRAND.developer,
  developerWebsiteUrl: BRAND.developerWebsiteUrl,
  copyright: "© 2026 ABO Sports TV",
} as const;

export const LEGAL_LINKS = {
  privacy: "/legal/abo-sports-tv-privacy-policy.pdf",
  terms: "/legal/abo-sports-tv-terms-of-service.pdf",
} as const;

/** Initial channels shown before "Load More" button */
export const CHANNEL_GRID_INITIAL = 12;
/** Channels loaded per "Load More" click */
export const CHANNEL_GRID_BATCH = 24;
export const FIXTURES_POLL_INTERVAL_MS = 90_000;
export const HIDE_CONTROLS_AFTER_MS = 3500;
export const HIDE_CONTROLS_INITIAL_MS = 8000;
export const LINK_RETRY_DELAY_MS = 800;
export const HLS_FRAG_LOAD_TIMEOUT_MS = 9_000;
export const RECENTLY_WATCHED_MAX = 10;
export const FAVORITES_MAX = 30;
