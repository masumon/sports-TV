import type { Channel } from "@/lib/types";

/** Primary stream first, then alternates; deduped by URL (ignoring hash). Only http(s). */
export function orderedStreamUrlsForChannel(ch: Channel): string[] {
  const raw = [ch.stream_url, ...(ch.alternate_urls ?? [])].filter(
    (u): u is string => Boolean(u && typeof u === "string" && u.trim().startsWith("http"))
  );
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of raw) {
    try {
      const x = new URL(u.trim());
      x.hash = "";
      const k = x.toString();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(u.trim());
    } catch {
      const t = u.trim();
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}
