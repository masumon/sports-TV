/**
 * Convenience barrel — re-exports the i18n hook and utilities.
 * Usage: import { useLanguage } from "@/lib/i18n";
 */
export { useI18n as useLanguage, I18nProvider, getStoredLocale } from "@/lib/i18n/LocaleContext";
export { translations, t } from "@/lib/i18n/translations";
export type { Locale } from "@/lib/i18n/translations";
