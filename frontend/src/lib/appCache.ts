import { clearChannelListCache } from "@/lib/channelListCache";
import { apiRequest } from "@/lib/apiClient";
import { useI18nStore } from "@/lib/i18n/LocaleContext";
import { useSiteSettingsStore } from "@/store/siteSettingsStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";

/**
 * Clears persisted client state (Zustand + channel list) and tells the server
 * to drop Redis list caches. Does not log the user out (gstv-welcome-hint is cleared).
 * @returns true if server acknowledged cache invalidation
 */
export async function clearAppCache(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  clearChannelListCache();
  try {
    localStorage.removeItem("gstv-welcome-hint");
  } catch {
    /* */
  }
  useSubscriptionStore.persist.clearStorage();
  useSiteSettingsStore.persist.clearStorage();
  useI18nStore.persist.clearStorage();
  // Keep login session: useAuthStore remains untouched

  try {
    await apiRequest<Record<string, string>>("/sports-tv/invalidate-cache", {
      method: "POST",
    });
    return true;
  } catch {
    return false;
  }
}
