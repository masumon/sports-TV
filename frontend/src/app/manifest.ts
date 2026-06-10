import type { MetadataRoute } from "next";

const ICON_192_PNG = "/icons/icon-192.png";
const ICON_512_PNG = "/icons/icon-512.png";
const ICON_MASKABLE_PNG = "/icons/icon-maskable-512.png";
const ICON_192_SVG = "/icons/icon-192.svg";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ABO SPORTS TV LIVE",
    short_name: "ABO Sports",
    description: "Global live sports, India & Bangladesh TV. Fast, PWA-ready streaming.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#080a11",
    theme_color: "#e8981f",
    categories: ["entertainment", "sports"],
    lang: "bn",
    dir: "ltr",
    prefer_related_applications: false,
    icons: [
      { src: ICON_192_PNG, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: ICON_512_PNG, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: ICON_MASKABLE_PNG, sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: ICON_192_SVG, sizes: "192x192", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Sports TV",
        short_name: "Sports",
        description: "Global sports channels live",
        url: "/?module=global_sports",
        icons: [{ src: ICON_192_PNG, sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Live Matches",
        short_name: "Live",
        description: "Live match center",
        url: "/live",
        icons: [{ src: ICON_192_PNG, sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Bangladesh TV",
        short_name: "BD",
        description: "Bangladesh live channels",
        url: "/?module=bangladesh",
        icons: [{ src: ICON_192_PNG, sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
