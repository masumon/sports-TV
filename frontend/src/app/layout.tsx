import type { Metadata, Viewport } from "next";
import { AppProviders } from "@/components/providers/AppProviders";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sports-tv-lovat.vercel.app";

export const metadata: Metadata = {
  title: {
    default: "ABO SPORTS TV LIVE",
    template: "%s · ABO SPORTS TV LIVE",
  },
  description:
    "ABO Sports TV Live — বিশ্বের সকল দেশের সব ধরনের খেলাধুলার চ্যানেল লাইভ স্ট্রিমিং। Real-time live scores, HD quality, PWA support.",
  applicationName: "ABO SPORTS TV LIVE",
  authors: [{ name: "ABO ENTERPRISE", url: "https://aboenterprise.netlify.app/" }],
  keywords: ["sports", "live tv", "streaming", "HLS", "football", "cricket", "basketball", "tennis", "ABO SPORTS TV LIVE", "ABO Enterprise", "Next.js", "PWA", "global sports"],
  appleWebApp: {
    capable: true,
    title: "ABO Sports TV",
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
    siteName: "ABO SPORTS TV LIVE",
    title: "ABO SPORTS TV LIVE",
    description: "বিশ্বের সকল দেশের সব ধরনের খেলাধুলার লাইভ স্ট্রিমিং প্ল্যাটফর্ম",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07080F" },
    { color: "#F5A623" },
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
