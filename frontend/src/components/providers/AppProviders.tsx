"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import Script from "next/script";
import { AuthSessionSync } from "@/components/AuthSessionSync";
import { I18nProvider } from "@/lib/i18n/LocaleContext";
import { useSiteSettingsStore } from "@/store/siteSettingsStore";

function AdSenseScript() {
  const { adsensePublisherId, adsenseEnabled } = useSiteSettingsStore();
  if (!adsenseEnabled || !adsensePublisherId) return null;
  return (
    <Script
      id="adsense"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsensePublisherId}`}
      crossOrigin="anonymous"
      strategy="lazyOnload"
    />
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <I18nProvider>
        <AdSenseScript />
        <AuthSessionSync />
        {children}
        <Toaster position="top-center" richColors closeButton />
      </I18nProvider>
    </ThemeProvider>
  );
}
