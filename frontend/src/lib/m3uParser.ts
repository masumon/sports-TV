export type ParsedM3UEntry = {
  name: string;
  streamUrl: string;
  logoUrl: string | null;
  groupTitle: string | null;
};

const ATTR = /([a-zA-Z0-9_-]+)="([^"]*)"/g;

function parseAttrString(attrStr: string): { logo: string | null; group: string | null } {
  const attrs: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR.lastIndex = 0;
  while ((m = ATTR.exec(attrStr)) !== null) {
    attrs[m[1].toLowerCase()] = m[2];
  }
  return {
    logo: attrs["tvg-logo"] || null,
    group: attrs["group-title"] || null,
  };
}

/** Parse standard IPTV M3U / M3U8 playlist text into channel rows. */
export function parseM3UPlaylist(text: string): ParsedM3UEntry[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const out: ParsedM3UEntry[] = [];
  let pending: { name: string; logo: string | null; group: string | null } | null = null;

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
      pending = {
        name: title || "Unknown",
        logo,
        group,
      };
      continue;
    }
    if (line.startsWith("#")) continue;
    if (!pending) continue;
    const streamUrl = line;
    if (streamUrl.startsWith("http://") || streamUrl.startsWith("https://")) {
      out.push({
        name: pending.name,
        streamUrl,
        logoUrl: pending.logo,
        groupTitle: pending.group,
      });
    }
    pending = null;
  }
  return out;
}
