"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { createJSONStorage, persist } from "zustand/middleware";
import { create } from "zustand";
import type { Locale } from "@/lib/i18n/translations";
import { t } from "@/lib/i18n/translations";

type I18nStore = {
  locale: Locale;
  setLocale: (l: Locale) => void;
};

const useI18nStore = create<I18nStore>()(
  persist(
    (set) => ({
      locale: "bn" as Locale,
      setLocale: (l) => set({ locale: l }),
    }),
    { name: "gstv-locale", storage: createJSONStorage(() => localStorage) }
  )
);

const I18nCtx = createContext<{ t: (key: string) => string; locale: Locale; setLocale: (l: Locale) => void } | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useI18nStore((s) => s.locale);
  const setLoc = useI18nStore((s) => s.setLocale);
  const tf = useCallback((key: string) => t(locale, key), [locale]);
  const value = useMemo(
    () => ({ t: tf, locale, setLocale: setLoc }),
    [tf, locale, setLoc]
  );
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const raw = localStorage.getItem("gstv-locale");
    if (!raw) return "bn";
    const s = JSON.parse(raw) as { state?: { locale?: Locale } };
    return s.state?.locale === "en" || s.state?.locale === "bn" ? s.state.locale : "bn";
  } catch {
    return "bn";
  }
}
