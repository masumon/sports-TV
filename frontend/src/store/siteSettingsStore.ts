import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SiteSettings = {
  /** Google AdSense publisher ID — e.g. ca-pub-1234567890 */
  adsensePublisherId: string;
  /** AdSense slot ID for banner ads */
  adsenseBannerSlot: string;
  /** AdSense slot ID for inline / rectangle ads */
  adsenseInlineSlot: string;
  /** Enable or disable ads entirely */
  adsenseEnabled: boolean;
};

type SiteSettingsStore = SiteSettings & {
  update: (patch: Partial<SiteSettings>) => void;
};

const defaults: SiteSettings = {
  adsensePublisherId: "",
  adsenseBannerSlot: "",
  adsenseInlineSlot: "",
  adsenseEnabled: false,
};

export const useSiteSettingsStore = create<SiteSettingsStore>()(
  persist(
    (set) => ({
      ...defaults,
      update: (patch) => set((s) => ({ ...s, ...patch })),
    }),
    {
      name: "abo-site-settings",
    }
  )
);
