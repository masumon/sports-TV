/** Single source of truth for ABO Sports TV brand assets and developer links. */
export const BRAND = {
  name: "ABO Sports TV",
  nameFull: "ABO SPORTS TV LIVE",
  developer: "ABO Enterprise",
  logo: {
    svg: "/icons/abo-logo.svg",
    png: "/icons/abo-sports-tv-logo.png",
    enterprise: "/icons/abo-enterprise-logo.png",
  },
  icons: {
    favicon192: "/icons/icon-192.png",
    favicon512: "/icons/icon-512.png",
    appleTouch: "/icons/apple-touch-icon.png",
    maskable: "/icons/icon-maskable-512.png",
    og: "/icons/og-image.png",
  },
  /** Preserved from legacy Website Icon / Globe button — sole developer entry point. */
  developerWebsiteUrl: "https://mumainsumon.netlify.app/",
  enterpriseUrl: "https://aboenterprise.netlify.app/",
} as const;
