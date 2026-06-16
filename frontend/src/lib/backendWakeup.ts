let pinged = false;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

export function wakeBackend(): void {
  if (typeof window === "undefined" || pinged) return;
  pinged = true;
  ping();
  startKeepAlive();
}

function ping(): void {
  fetch("/health", { method: "GET", cache: "no-store" }).catch(() => {});
}

function startKeepAlive(): void {
  if (keepAliveTimer !== null) return;
  // Ping every 10 minutes while the page is visible — keeps Render free tier awake.
  keepAliveTimer = setInterval(() => {
    if (document.visibilityState === "visible") ping();
  }, 10 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") ping();
  }, { once: false });
}
