/** Pre-warm backup HLS manifests while primary plays (silent HEAD/manifest peek). */
export function warmBackupStreams(urls: string[], currentIndex: number): void {
  if (typeof window === "undefined" || urls.length <= 1) return;
  const backups = urls.filter((_, i) => i !== currentIndex).slice(0, 2);
  for (const url of backups) {
    if (!url) continue;
    fetch(url, { method: "GET", mode: "cors", credentials: "omit", cache: "no-store" }).catch(() => {});
  }
}
