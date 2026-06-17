/** Fire-and-forget event tracking for admin insights. Never throws, never awaits. */

export type AnalyticsEventType =
  | "APP_OPEN"
  | "CHANNEL_OPEN"
  | "PLAYBACK_START"
  | "PLAYBACK_SUCCESS"
  | "PLAYBACK_FAIL"
  | "SERVER_SWITCH"
  | "QUALITY_CHANGE"
  | "SEARCH"
  | "SEARCH_NO_RESULT"
  | "PLAYER_ERROR"
  | "QUICK_EXIT";

export type TrackPayload = {
  channel_id?: number;
  channel_name?: string;
  value?: number;
  meta?: string;
};

export function trackEvent(type: AnalyticsEventType, payload: TrackPayload = {}): void {
  if (typeof fetch === "undefined") return;
  try {
    fetch("/api/v1/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: type, ...payload }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never throw */
  }
}
