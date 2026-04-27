import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import type { RuntimeCaching } from "workbox-build";

/**
 * PWA (Workbox) was caching every same-origin `GET /api/*` in the "apis" cache
 * (NetworkFirst, 24h). HLS traffic goes through `/api/v1/proxy/stream` and must
 * never be stored — a stale 502/empty body breaks playback for all channels
 * until the cache entry expires. We extend the default runtime list and
 * (1) bypass cache entirely for the stream proxy, (2) keep "apis" for other API
 * GETs but exclude `/api/v1/proxy/*` from that rule.
 */
const pwaStreamSafeRuntimeCaching: RuntimeCaching[] = [
  {
    urlPattern: ({ sameOrigin, url: { pathname } }) =>
      Boolean(sameOrigin && pathname.startsWith("/api/v1/proxy/")),
    handler: "NetworkOnly",
    method: "GET",
  },
  {
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
      expiration: {
        maxEntries: 16,
        maxAgeSeconds: 86400,
      },
      networkTimeoutSeconds: 10,
    },
  },
];

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/offline",
  },
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: pwaStreamSafeRuntimeCaching,
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
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  // Proxy all /api/* requests to the Render backend so the frontend never
  // needs to hardcode an absolute URL and avoids CORS preflight issues.
  async rewrites() {
    return [
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
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
