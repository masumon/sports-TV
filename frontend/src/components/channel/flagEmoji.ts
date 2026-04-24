/** 2-letter region codes (e.g. US, DE) → flag; otherwise 🌐 */
export function flagFromCountryName(country: string): string {
  const t = country.trim();
  if (t.length === 2 && /^[A-Za-z]{2}$/.test(t)) {
    const a = t.toUpperCase();
    const base = 0x1f1e6;
    return String.fromCodePoint(base + (a.charCodeAt(0) - 65), base + (a.charCodeAt(1) - 65));
  }
  return "🌐";
}
