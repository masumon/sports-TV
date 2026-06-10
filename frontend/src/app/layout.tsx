import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { SkipToContentLink } from "@/components/SkipToContentLink";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const notoSansBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-bengali",
});

// Preview: built-in VERCEL_URL keeps OG/metadataBase off production domain.
const siteUrl = (() => {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  }
  const fromPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromPublic) return fromPublic;
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  }
  return "https://sports-tv-lovat.vercel.app";
})();

export const metadata: Metadata = {
  title: {
    default: "ABO SPORTS TV LIVE",
    template: "%s · ABO SPORTS TV LIVE",
  },
  description:
    "Watch live sports from around the world. Global channels, HD quality, mobile-optimized streaming.",
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
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", type: "image/svg+xml", sizes: "192x192" },
      { url: "/icons/icon-512.svg", type: "image/svg+xml", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/icon-192.svg", type: "image/svg+xml", sizes: "192x192" }],
  },
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "bn_BD",
    url: siteUrl,
    siteName: "ABO SPORTS TV LIVE",
    title: "ABO SPORTS TV LIVE",
    description: "বিশ্বের সকল দেশের সব ধরনের খেলাধুলার লাইভ স্ট্রিমিং প্ল্যাটফর্ম",
    images: [
      {
        url: `${siteUrl}/icons/icon-512.svg`,
        width: 512,
        height: 512,
        alt: "ABO SPORTS TV LIVE",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "ABO SPORTS TV LIVE",
    description: "বিশ্বের সকল দেশের সব ধরনের খেলাধুলার লাইভ স্ট্রিমিং",
    images: [`${siteUrl}/icons/icon-512.svg`],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0E17" },
    { color: "#F5C518" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="bn"
      className={`${inter.variable} ${notoSansBengali.variable} dark`}
      suppressHydrationWarning
    >
      <body
        className={`flex min-h-dvh min-h-screen flex-col bg-surface font-sans text-foreground antialiased ${inter.className}`}
        style={{
          fontFamily: `var(--font-inter), var(--font-bengali), "Noto Sans Bengali", system-ui, sans-serif`,
        }}
      >
        <AppProviders>
          <SkipToContentLink />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": "ABO SPORTS TV LIVE",
                "url": siteUrl,
                "description": "বিশ্বের সকল দেশের সব ধরনের খেলাধুলার লাইভ স্ট্রিমিং",
                "potentialAction": {
                  "@type": "SearchAction",
                  "target": { "@type": "EntryPoint", "urlTemplate": `${siteUrl}/?q={search_term_string}` },
                  "query-input": "required name=search_term_string"
                }
              }),
            }}
          />
          <div id="main-content" className="flex flex-1 flex-col outline-none" tabIndex={-1}>
            {children}
          </div>
          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
