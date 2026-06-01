import type { Metadata, Viewport } from "next";
import { Inter, Hind_Siliguri } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { SkipToContentLink } from "@/components/SkipToContentLink";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const hindSiliguri = Hind_Siliguri({
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
    "ABO Sports TV Live — বিশ্বের সকল দেশের সব ধরনের খেলাধুলার চ্যানেল লাইভ স্ট্রিমিং। HD quality, PWA support.",
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
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
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
        url: `${siteUrl}/icons/icon-512.png`,
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
    images: [`${siteUrl}/icons/icon-512.png`],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080a11" },
    { color: "#e8981f" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={`${inter.variable} ${hindSiliguri.variable}`} suppressHydrationWarning>
      <body className={`flex min-h-dvh min-h-screen flex-col antialiased font-sans ${inter.className}`}
        style={{ fontFamily: `var(--font-inter), var(--font-bengali), system-ui, sans-serif` }}>
        <AppProviders>
          <SkipToContentLink />
          <div id="main-content" className="flex flex-1 flex-col outline-none" tabIndex={-1}>
            {children}
          </div>
          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
