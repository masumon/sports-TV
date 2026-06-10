"use client";

import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import Script from "next/script";
import { AuthSessionSync } from "@/components/AuthSessionSync";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { I18nProvider } from "@/lib/i18n/LocaleContext";
import { SplashScreen } from "@/components/SplashScreen";
import { buildApiUrl } from "@/lib/apiClient";
import { getChannelListCache, hydrateChannelListCache } from "@/lib/channelListCache";
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

/** Warm IDB + prefetch API routes silently on launch */
function BackgroundAutoRefresh() {
  useEffect(() => {
    void hydrateChannelListCache();
    void Promise.allSettled([
      fetch(buildApiUrl("/sports-tv/channels?page=1&page_size=24"), { cache: "default" }),
      fetch(buildApiUrl("/sports-tv/filters"), { cache: "default" }),
      fetch(buildApiUrl("/sports-tv/fixtures?hours_back=6&days_ahead=2"), { cache: "default" }),
    ]);
  }, []);
  return null;
}

function AppSplashGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (!cancelled) setReady(true);
    };
    const hasCache = (getChannelListCache()?.length ?? 0) > 0;
    void hydrateChannelListCache().finally(finish);
    const t = setTimeout(finish, hasCache ? 420 : 1000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  return (
    <>
      <SplashScreen ready={ready} />
      {children}
    </>
  );
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
        <BackgroundAutoRefresh />
        <AuthSessionSync />
        <AppSplashGate>{children}</AppSplashGate>
        <PwaInstallBanner />
        <Toaster position="top-center" richColors closeButton />
      </I18nProvider>
    </ThemeProvider>
  );
}
