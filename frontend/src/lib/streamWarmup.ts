const WARMUP_ABORT_MS = 4000;

/** Pre-warm backup HLS manifests while primary plays (aborted peek — no hung connections). */
export function warmBackupStreams(urls: string[], currentIndex: number): void {
  if (typeof window === "undefined" || urls.length <= 1) return;
  const backups = urls.filter((_, i) => i !== currentIndex).slice(0, 2);
  for (const url of backups) {
    if (!url) continue;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), WARMUP_ABORT_MS);
    fetch(url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      signal: ctrl.signal,
    })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  }
}
