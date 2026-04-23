"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthSessionSync } from "@/components/AuthSessionSync";
import { I18nProvider } from "@/lib/i18n/LocaleContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <I18nProvider>
        <AuthSessionSync />
        {children}
        <Toaster position="top-center" richColors closeButton />
      </I18nProvider>
    </ThemeProvider>
  );
}
