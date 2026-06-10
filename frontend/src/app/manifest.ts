import type { MetadataRoute } from "next";

/** Icons live under /public/icons as SVG — PNG paths were broken and blocked install. */
const ICON_192 = "/icons/icon-192.svg";
const ICON_512 = "/icons/icon-512.svg";
const ICON_MASKABLE = "/icons/icon-maskable.svg";

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
      { src: ICON_192, sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: ICON_512, sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: ICON_MASKABLE, sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Sports TV",
        short_name: "Sports",
        description: "Global sports channels live",
        url: "/?module=global_sports",
        icons: [{ src: ICON_192, sizes: "192x192", type: "image/svg+xml" }],
      },
      {
        name: "Live Matches",
        short_name: "Live",
        description: "Live match center",
        url: "/live",
        icons: [{ src: ICON_192, sizes: "192x192", type: "image/svg+xml" }],
      },
      {
        name: "Bangladesh TV",
        short_name: "BD",
        description: "Bangladesh live channels",
        url: "/?module=bangladesh",
        icons: [{ src: ICON_192, sizes: "192x192", type: "image/svg+xml" }],
      },
    ],
  };
}
