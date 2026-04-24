import type { Metadata, Viewport } from "next";
import { AppProviders } from "@/components/providers/AppProviders";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sports-tv-lovat.vercel.app";

export const metadata: Metadata = {
  title: {
    default: "Global Sports Live TV",
    template: "%s · Global Sports Live TV",
  },
  description:
    "Premium global sports live TV streaming with real-time score overlays, HLS player, and JWT-secured admin.",
  applicationName: "Global Sports Live TV",
  authors: [{ name: "Mumain Ahmed", url: "https://mumainsumon.netlify.app/" }],
  keywords: ["sports", "live tv", "streaming", "HLS", "Bangladesh", "FastAPI", "Next.js", "PWA"],
  appleWebApp: {
    capable: true,
    title: "GSTV Live",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "bn_BD",
    url: siteUrl,
    siteName: "Global Sports Live TV",
    title: "Global Sports Live TV",
    description: "লাইভ স্পোর্টস স্ট্রিমিং ও রিয়েল-টাইম স্কোর প্ল্যাটফর্ম",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
    { color: "#0ea5e9" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col antialiased">
        <AppProviders>
          <div className="flex flex-1 flex-col">{children}</div>
          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
