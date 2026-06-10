/**
 * Pings the backend /health endpoint on app startup so that Render free-tier
 * services wake up before the user tries to play a channel.
 *
 * Called once per browser session. Safe to call multiple times — a module-level
 * flag ensures only one request ever fires per page load.
 */

import { buildApiUrl } from "@/lib/apiClient";

let pinged = false;

export function wakeBackend(): void {
  if (typeof window === "undefined" || pinged) return;
  pinged = true;
  const url = buildApiUrl("/health").replace("/api/v1/health", "/health");
  // Fire-and-forget — we don't need the response, just need the server to wake up.
  fetch(url, { method: "GET", cache: "no-store" }).catch(() => {
    // Ignore errors — server may still be waking up; streams will retry on their own.
  });
}
