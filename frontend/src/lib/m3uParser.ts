export type ParsedM3UEntry = {
  name: string;
  streamUrl: string;
  logoUrl: string | null;
  groupTitle: string | null;
  /** Extracted from #EXTVLCOPT:http-user-agent= or #EXTHTTP User-Agent */
  userAgent?: string | null;
  /** Extracted from #EXTVLCOPT:http-referrer= or #EXTHTTP Referer */
  referer?: string | null;
};

// Note: regex created inside function to avoid shared lastIndex state across calls.
function parseAttrString(attrStr: string): { logo: string | null; group: string | null } {
  const ATTR = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
  const attrs: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = ATTR.exec(attrStr)) !== null) {
    attrs[m[1].toLowerCase()] = m[2];
  }
  return {
    logo: attrs["tvg-logo"] || null,
    group: attrs["group-title"] || null,
  };
}

/**
 * Safely extract user-agent and referer from #EXTHTTP JSON line.
 * Only known safe fields are extracted \u2014 no arbitrary header injection.
 */
function parseExtHttp(line: string): { userAgent: string | null; referer: string | null } {
  try {
    const jsonStr = line.slice("#EXTHTTP:".length).trim();
    const obj = JSON.parse(jsonStr) as Record<string, unknown>;
    const ua = (obj["User-Agent"] ?? obj["user-agent"] ?? null);
    const ref = (obj["Referer"] ?? obj["referer"] ?? null);
    return {
      userAgent: typeof ua === "string" && ua ? ua : null,
      referer: typeof ref === "string" && ref ? ref : null,
    };
  } catch {
    return { userAgent: null, referer: null };
  }
}

/** Reject titles polluted by malformed EXTINF metadata (user-agent strings, etc.). */
function isValidChannelName(name: string): boolean {
  const t = name.trim();
  if (!t || t.length > 200) return false;
  const lower = t.toLowerCase();
  if (
    lower.includes("mozilla/") ||
    lower.includes("like gecko") ||
    lower.includes("chrome/") ||
    lower.includes("safari/") ||
    lower.includes("user-agent") ||
    lower.includes("group-title=")
  ) {
    return false;
  }
  return true;
}

/** Pull a clean title from a messy EXTINF tail (malformed attribute blobs). */
function sanitizeExtInfTitle(rawTitle: string, parsedGroup: string | null): string {
  let title = rawTitle.trim();
  if (!title) return "Unknown";

  const groupMatch = title.match(/group-title="([^"]*)"\s*,\s*(.+)$/i);
  if (groupMatch?.[2]) title = groupMatch[2].trim();

  const lastComma = title.lastIndexOf(",");
  if (lastComma > 0 && (title.includes("http-") || title.includes('="'))) {
    const after = title.slice(lastComma + 1).trim();
    if (after && !after.includes('="')) title = after;
  }

  if (!isValidChannelName(title) && parsedGroup) {
    const fromGroup = parsedGroup.split(";")[0]?.trim();
    if (fromGroup && isValidChannelName(fromGroup)) return fromGroup;
  }

  return isValidChannelName(title) ? title : "";
}
export function parseM3UPlaylist(text: string): ParsedM3UEntry[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const out: ParsedM3UEntry[] = [];
  let pending: {
    name: string;
    logo: string | null;
    group: string | null;
    userAgent: string | null;
    referer: string | null;
  } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      const rest = line.slice("#EXTINF:".length);
      const commaIdx = rest.indexOf(",");
      const meta = commaIdx === -1 ? rest.trim() : rest.slice(0, commaIdx).trim();
      const title = commaIdx === -1 ? "" : rest.slice(commaIdx + 1).trim();
      const metaMatch = meta.match(/^(-?\d+)\s*(.*)$/);
      const attrStr = metaMatch?.[2]?.trim() ?? "";
      const { logo, group } = parseAttrString(attrStr);
      const cleanTitle = sanitizeExtInfTitle(title || "Unknown", group);
      if (!cleanTitle) {
        pending = null;
        continue;
      }
      pending = { name: cleanTitle, logo, group, userAgent: null, referer: null };
      continue;
    }

    // #EXTVLCOPT \u2014 VLC/ExoPlayer options (user-agent, referrer)
    if (line.startsWith("#EXTVLCOPT:") && pending) {
      const opt = line.slice("#EXTVLCOPT:".length).trim();
      const eqIdx = opt.indexOf("=");
      if (eqIdx !== -1) {
        const key = opt.slice(0, eqIdx).trim().toLowerCase();
        const val = opt.slice(eqIdx + 1).trim();
        if (key === "http-user-agent" && val) pending.userAgent = val;
        if ((key === "http-referrer" || key === "http-referer") && val) pending.referer = val;
      }
      continue;
    }

    // #EXTHTTP \u2014 JSON headers (OTT Navigator format)
    if (line.startsWith("#EXTHTTP:") && pending) {
      const { userAgent, referer } = parseExtHttp(line);
      if (userAgent && !pending.userAgent) pending.userAgent = userAgent;
      if (referer && !pending.referer) pending.referer = referer;
      continue;
    }

    if (line.startsWith("#")) continue;
    if (!pending) continue;

    const streamUrl = line;
    const isProxiedPath =
      streamUrl.startsWith("/api/v1/proxy/stream") || streamUrl.startsWith("/api/proxy/");
    if (
      streamUrl.startsWith("http://") ||
      streamUrl.startsWith("https://") ||
      isProxiedPath
    ) {
      out.push({
        name: pending.name,
        streamUrl,
        logoUrl: pending.logo,
        groupTitle: pending.group,
        userAgent: pending.userAgent || null,
        referer: pending.referer || null,
      });
    }
    pending = null;
  }
  return out;
}
