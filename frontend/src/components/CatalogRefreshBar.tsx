"use client";

import { useI18n } from "@/lib/i18n/LocaleContext";

interface CatalogRefreshBarProps {
  active: boolean;
  progress: number;
  fromCache?: boolean;
}

/** Top progress strip while the channel catalog refreshes in the background. */
export function CatalogRefreshBar({ active, progress, fromCache }: CatalogRefreshBarProps) {
  const { t } = useI18n();
  if (!active) return null;

  const pct = Math.min(100, Math.max(0, progress));

  return (
    <div
      className="catalog-refresh-bar"
      role="status"
      aria-live="polite"
      aria-label={fromCache ? t("updatingFromCache") : t("loading")}
    >
      <div className="catalog-refresh-bar__track" aria-hidden>
        <div className="catalog-refresh-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="catalog-refresh-bar__label">
        <span className="catalog-refresh-bar__spinner" aria-hidden />
        <span>{fromCache ? t("updatingFromCache") : t("loading")}</span>
      </p>
    </div>
  );
}
