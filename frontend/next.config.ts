import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/offline",
  },
});

// Backend origin for the Next.js proxy rewrite.
// Set BACKEND_URL in Vercel Environment Variables (no trailing slash, no /api path).
// Example: https://gstv-backend.onrender.com
// Falls back to the production Render service URL if not set.
const BACKEND_URL = (process.env.BACKEND_URL ?? "https://gstv-backend.onrender.com").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
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
      // Cache static assets aggressively
      {
        source: "/(icons|images|fonts)/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Cache PWA manifest
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=3600" },
        ],
      },
      // API proxy — short cache with stale-while-revalidate for channels
      {
        source: "/api/v1/sports-tv/channels(.*)",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=120" },
        ],
      },
      // Security headers for all pages
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
