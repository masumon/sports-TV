/**
 * Expand curated directory / landing-page URLs to fetchable M3U endpoints.
 * Keeps user-facing config URLs stable while avoiding HTML responses in /proxy/playlist.
 */
const PLAYLIST_DIRECTORY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "https://iptvplayer.stream/public-iptv-playlist": [
    "https://iptv-org.github.io/iptv/index.m3u",
    "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
  ],
};

function normPlaylistUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    return u.toString();
  } catch {
    return url.trim();
  }
}

/** Resolve directory pages to raw M3U URLs; dedupe while preserving order. */
export function expandPlaylistUrls(urls: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of urls) {
    const trimmed = (raw || "").trim();
    if (!trimmed.startsWith("http")) continue;

    const expanded = PLAYLIST_DIRECTORY_ALIASES[trimmed] ?? [trimmed];
    for (const candidate of expanded) {
      const key = normPlaylistUrl(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(candidate);
    }
  }

  return out;
}
