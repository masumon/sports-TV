import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ABO SPORTS TV LIVE",
    short_name: "ABO Sports",
    description: "Global live sports, India & Bangladesh TV. Fast, PWA-ready streaming.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#07080F",
    theme_color: "#F5A623",
    categories: ["entertainment", "sports"],
    lang: "bn",
    dir: "ltr",
    prefer_related_applications: false,
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "🌍 Sports TV",
        short_name: "Sports",
        description: "বিশ্বের সকল স্পোর্টস চ্যানেল লাইভ",
        url: "/?module=sports",
        icons: [{ src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" }],
      },
      {
        name: "🇮🇳 India TV",
        short_name: "India",
        description: "India — all types of live channels",
        url: "/?module=india",
        icons: [{ src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" }],
      },
      {
        name: "🇧🇩 Bangladesh TV",
        short_name: "BD TV",
        description: "বাংলাদেশের সকল টিভি চ্যানেল লাইভ",
        url: "/?module=bangladesh",
        icons: [{ src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" }],
      },
    ],
  };
}
