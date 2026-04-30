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

/**
 * URLs used for catalog dedupe / DB↔viewer matching. Prefers http(s) from
 * {@link orderedStreamUrlsForChannel}; if none (e.g. only non-HTTP `stream_url`),
 * falls back to the raw primary so DB-only rows still merge and append correctly.
 */
export function allStreamUrlsForChannel(ch: Channel): string[] {
  const fromOrdered = orderedStreamUrlsForChannel(ch);
  if (fromOrdered.length > 0) return fromOrdered;
  const primary = (ch.stream_url || "").trim();
  return primary ? [primary] : [];
}
