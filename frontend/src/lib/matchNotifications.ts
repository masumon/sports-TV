import { BRAND } from "@/lib/branding";

const PREF_KEY = "gstv-match-alerts";
const NOTIFIED_PREFIX = "gstv-notif-";

export function isNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotifPermission(): NotificationPermission | null {
  if (!isNotificationsSupported()) return null;
  return Notification.permission;
}

export function getNotifPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "true";
  } catch {
    return false;
  }
}

export function setNotifPref(v: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, v ? "true" : "false");
  } catch {}
}

export async function requestNotifPermission(): Promise<NotificationPermission> {
  if (!isNotificationsSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export function checkAndFireUpcomingNotifications(
  fixtures: Array<{
    home_team: string;
    away_team: string;
    league_name: string;
    starts_at_utc: string;
  }>
): void {
  if (
    !isNotificationsSupported() ||
    Notification.permission !== "granted" ||
    !getNotifPref()
  )
    return;

  const now = Date.now();
  for (const fx of fixtures) {
    if (!fx.starts_at_utc) continue;
    const startMs = new Date(fx.starts_at_utc).getTime();
    const minUntil = (startMs - now) / 60_000;
    if (minUntil > 0 && minUntil <= 15) {
      const key = `${NOTIFIED_PREFIX}${fx.starts_at_utc}-${fx.home_team}-${fx.away_team}`;
      try {
        if (localStorage.getItem(key)) continue;
        localStorage.setItem(key, "1");
      } catch {}
      try {
        new Notification(`⚽ ${fx.home_team} vs ${fx.away_team}`, {
          body: `${fx.league_name} — ${Math.ceil(minUntil)} মিনিটে শুরু হবে!`,
          icon: BRAND.logo.png,
          tag: `wc26-${fx.home_team}-${fx.away_team}`,
        });
      } catch {}
    }
  }
}
