"use client";

import { useI18n } from "@/lib/i18n/LocaleContext";

export function SkipToContentLink() {
  const { t } = useI18n();
  return (
    <a href="#main-content" className="skip-to-content">
      {t("skipToContent")}
    </a>
  );
}
