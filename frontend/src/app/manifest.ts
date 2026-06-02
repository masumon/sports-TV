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
    background_color: "#080a11",
    theme_color: "#e8981f",
    categories: ["entertainment", "sports"],
    lang: "bn",
    dir: "ltr",
    prefer_related_applications: false,
    screenshots: [
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", form_factor: "wide" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", form_factor: "narrow" },
    ],
    icons: [
      { src: "/icons/icon-192.png",    sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png",    sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "🌍 Sports TV",
        short_name: "Sports",
        description: "বিশ্বের সকল স্পোর্টস চ্যানেল লাইভ",
        url: "/?module=sports",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "🇮🇳 India TV",
        short_name: "India",
        description: "India — all types of live channels",
        url: "/?module=india",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "🇧🇩 Bangladesh TV",
        short_name: "BD TV",
        description: "বাংলাদেশের সকল টিভি চ্যানেল লাইভ",
        url: "/?module=bangladesh",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
