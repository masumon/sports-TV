import type { NextConfig } from "next";
import withPWAInit, { runtimeCaching } from "@ducanh2912/next-pwa";
import type { RuntimeCaching } from "workbox-build";

const defaultCache = runtimeCaching as RuntimeCaching[];
if (
  !defaultCache.some(
    (e) => e?.options && typeof e.options === "object" && (e.options as { cacheName?: string }).cacheName === "apis",
  )
) {
  throw new Error("next-pwa: missing default 'apis' cache — update this file if the plugin changed");
}

const proxyStreamNetworkOnly: RuntimeCaching = {
  urlPattern: ({ sameOrigin, url: { pathname } }) =>
    Boolean(sameOrigin && pathname.startsWith("/api/v1/proxy/")),
  handler: "NetworkOnly",
  method: "GET",
  options: undefined,
};

const apisRestNetworkFirst: RuntimeCaching = {
  urlPattern: ({ sameOrigin, url: { pathname } }) =>
    Boolean(
      sameOrigin &&
        pathname.startsWith("/api/") &&
        !pathname.startsWith("/api/auth/callback") &&
        !pathname.startsWith("/api/v1/proxy/"),
    ),
  handler: "NetworkFirst",
  method: "GET",
  options: {
    cacheName: "apis",
    expiration: { maxEntries: 16, maxAgeSeconds: 86_400 },
    networkTimeoutSeconds: 10,
  },
};

/**
 * next-pwa prepends custom `runtimeCaching` then merges defaults, so the stock
 * `NetworkFirst` rule for all `/api/*` stayed active and cached HLS/playlist
 * traffic — stale bodies → freezes and broken playback, worse in PWA. We
 * **replace** the default list, drop the old `apis` entry, and register two
 * rules in order: NetworkOnly for `/api/v1/proxy/*`, NetworkFirst for the rest.
 */
const pwaWorkboxRuntimeCaching: RuntimeCaching[] = [
  ...defaultCache.filter(
    (e) => !e?.options || (e.options as { cacheName?: string }).cacheName !== "apis",
  ),
  proxyStreamNetworkOnly,
  apisRestNetworkFirst,
];

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/offline",
  },
  extendDefaultRuntimeCaching: false,
  workboxOptions: {
    runtimeCaching: pwaWorkboxRuntimeCaching,
  },
});

// Backend origin for the Next.js proxy rewrite.
// Set BACKEND_URL in Vercel Environment Variables (no trailing slash, no /api path).
// Example: https://gstv-backend.onrender.com
// Falls back to localhost in development so local API checks do not hit production.
const DEFAULT_BACKEND_URL =
  process.env.NODE_ENV === "production"
    ? "https://gstv-backend.onrender.com"
    : "http://localhost:8000";
// Treat "" as unset so Vercel env rows left blank still use the default origin.
const BACKEND_URL = (process.env.BACKEND_URL?.trim() || DEFAULT_BACKEND_URL).replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [32, 48, 64, 96],
    // Channel logos come from arbitrary CDN origins — allow all remote patterns.
    // unoptimized=true is used on the component side to skip server-side resizing.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  // Proxy all /api/* requests to the Render backend so the frontend never
  // needs to hardcode an absolute URL and avoids CORS preflight issues.
  async rewrites() {
    return [
      {
        source: "/health",
        destination: `${BACKEND_URL}/health`,
      },
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/v1/proxy/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/api/v1/sports-tv/channels(.*)",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=120" },
          { key: "CDN-Cache-Control", value: "public, s-maxage=300" },
        ],
      },
      {
        source: "/api/v1/sports-tv/filters",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=600, stale-while-revalidate=300" },
          { key: "CDN-Cache-Control", value: "public, s-maxage=600" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, no-cache, must-revalidate, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/(icons|images|fonts)/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=3600" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            // media-src * — IPTV streams come from arbitrary CDNs/origins
            // img-src * data: blob: — channel logos from arbitrary CDNs
            // connect-src * blob: — HLS segment fetches + API
            // worker-src 'self' blob: — HLS.js web workers + SW
            // unsafe-inline/unsafe-eval required by Next.js runtime and HLS.js
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src * data: blob:",
              "media-src * blob:",
              "connect-src * blob:",
              "font-src 'self' data:",
              "worker-src 'self' blob:",
              "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
