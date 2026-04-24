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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Proxy all /api/* requests to the Render backend so the frontend never
  // needs to hardcode an absolute URL and avoids CORS preflight issues.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://gstv-backend.onrender.com/api/:path*",
      },
    ];
  },
};

export default withPWA(nextConfig);
