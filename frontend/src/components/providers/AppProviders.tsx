"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import Script from "next/script";
import { AuthSessionSync } from "@/components/AuthSessionSync";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { I18nProvider } from "@/lib/i18n/LocaleContext";
import { useSiteSettingsStore } from "@/store/siteSettingsStore";
import { useThemeAccentStore } from "@/store/themeAccentStore";

/** Syncs the persisted accent preference to the <html data-accent> attribute on mount. */
function ThemeAccentSync() {
  const accent = useThemeAccentStore((s) => s.accent);
  useEffect(() => {
    if (accent === "gold") {
      document.documentElement.removeAttribute("data-accent");
    } else {
      document.documentElement.setAttribute("data-accent", accent);
    }
  }, [accent]);
  return null;
}

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
        <ThemeAccentSync />
        <AdSenseScript />
        <AuthSessionSync />
        {children}
        <PwaInstallBanner />
        <Toaster position="top-center" richColors closeButton />
      </I18nProvider>
    </ThemeProvider>
  );
}
