import type { MetadataRoute } from "next";

const ICON_192_PNG = "/icons/icon-192.png";
const ICON_512_PNG = "/icons/icon-512.png";
const ICON_MASKABLE_PNG = "/icons/icon-maskable-512.png";
const ICON_192_SVG = "/icons/icon-192.svg";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?source=pwa",
    name: "ABO SPORTS TV LIVE",
    short_name: "ABO Sports",
    description: "Watch FIFA World Cup 2026, live football, cricket & global sports — HD streaming, PWA-ready.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#080a11",
    theme_color: "#080a11",
    categories: ["entertainment", "sports"],
    lang: "en",
    dir: "ltr",
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-96.png",         sizes: "96x96",   type: "image/png",     purpose: "any"       },
      { src: ICON_192_PNG,                  sizes: "192x192", type: "image/png",     purpose: "any"       },
      { src: ICON_512_PNG,                  sizes: "512x512", type: "image/png",     purpose: "any"       },
      { src: ICON_MASKABLE_PNG,             sizes: "512x512", type: "image/png",     purpose: "maskable"  },
      { src: ICON_192_SVG,                  sizes: "any",     type: "image/svg+xml", purpose: "any"       },
    ],
    shortcuts: [
      {
        name: "World Cup 2026",
        short_name: "WC 2026",
        description: "FIFA World Cup 2026 live channels & schedule",
        url: "/?module=world_cup_2026&source=shortcut",
        icons: [{ src: ICON_192_PNG, sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Live Matches",
        short_name: "Live",
        description: "Live football & cricket match center",
        url: "/?module=live_matches&source=shortcut",
        icons: [{ src: ICON_192_PNG, sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Global Sports",
        short_name: "Sports",
        description: "Global sports channels — football, cricket & more",
        url: "/?module=global_sports&source=shortcut",
        icons: [{ src: ICON_192_PNG, sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
