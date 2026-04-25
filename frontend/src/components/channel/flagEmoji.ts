/** Full country name → 2-letter ISO-3166-1 alpha-2 code (lowercase keys) */
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  "afghanistan": "AF", "albania": "AL", "algeria": "DZ", "andorra": "AD",
  "angola": "AO", "argentina": "AR", "armenia": "AM", "australia": "AU",
  "austria": "AT", "azerbaijan": "AZ", "bahrain": "BH", "bangladesh": "BD",
  "belarus": "BY", "belgium": "BE", "bolivia": "BO", "bosnia and herzegovina": "BA",
  "brazil": "BR", "brunei": "BN", "bulgaria": "BG", "cambodia": "KH",
  "cameroon": "CM", "canada": "CA", "chile": "CL", "china": "CN",
  "colombia": "CO", "costa rica": "CR", "croatia": "HR", "cuba": "CU",
  "cyprus": "CY", "czech republic": "CZ", "denmark": "DK", "ecuador": "EC",
  "egypt": "EG", "el salvador": "SV", "estonia": "EE", "ethiopia": "ET",
  "finland": "FI", "france": "FR", "georgia": "GE", "germany": "DE",
  "ghana": "GH", "greece": "GR", "guatemala": "GT", "honduras": "HN",
  "hong kong": "HK", "hungary": "HU", "iceland": "IS", "india": "IN",
  "indonesia": "ID", "iran": "IR", "iraq": "IQ", "ireland": "IE",
  "israel": "IL", "italy": "IT", "jamaica": "JM", "japan": "JP",
  "jordan": "JO", "kazakhstan": "KZ", "kenya": "KE", "kuwait": "KW",
  "kyrgyzstan": "KG", "latvia": "LV", "lebanon": "LB", "libya": "LY",
  "lithuania": "LT", "luxembourg": "LU", "malaysia": "MY", "maldives": "MV",
  "malta": "MT", "mexico": "MX", "moldova": "MD", "mongolia": "MN",
  "montenegro": "ME", "morocco": "MA", "myanmar": "MM", "nepal": "NP",
  "netherlands": "NL", "new zealand": "NZ", "nicaragua": "NI", "nigeria": "NG",
  "north korea": "KP", "north macedonia": "MK", "norway": "NO", "oman": "OM",
  "pakistan": "PK", "palestine": "PS", "panama": "PA", "paraguay": "PY",
  "peru": "PE", "philippines": "PH", "poland": "PL", "portugal": "PT",
  "puerto rico": "PR", "qatar": "QA", "romania": "RO", "russia": "RU",
  "saudi arabia": "SA", "senegal": "SN", "serbia": "RS", "singapore": "SG",
  "slovakia": "SK", "slovenia": "SI", "somalia": "SO", "south africa": "ZA",
  "south korea": "KR", "spain": "ES", "sri lanka": "LK", "sudan": "SD",
  "sweden": "SE", "switzerland": "CH", "syria": "SY", "taiwan": "TW",
  "tajikistan": "TJ", "tanzania": "TZ", "thailand": "TH", "tunisia": "TN",
  "turkey": "TR", "turkmenistan": "TM", "ukraine": "UA",
  "united arab emirates": "AE", "uae": "AE",
  "united kingdom": "GB", "uk": "GB", "great britain": "GB",
  "united states": "US", "usa": "US", "us": "US",
  "uruguay": "UY", "uzbekistan": "UZ", "venezuela": "VE", "vietnam": "VN",
  "yemen": "YE", "zimbabwe": "ZW",
  // Common aliases
  "international": "UN", "global": "UN",
  "korea": "KR", "republic of korea": "KR",
  "iran, islamic republic of": "IR",
  "taiwan, province of china": "TW",
  "czech": "CZ", "czechia": "CZ",
};

function _codeToFlag(code: string): string {
  const a = code.toUpperCase();
  const base = 0x1f1e6;
  return String.fromCodePoint(base + (a.charCodeAt(0) - 65), base + (a.charCodeAt(1) - 65));
}

/**
 * Converts a country name or 2-letter ISO code to a flag emoji.
 * Accepts both "US" and "United States". Falls back to 🌐.
 */
export function flagFromCountryName(country: string): string {
  const t = country.trim();
  if (!t) return "🌐";

  // 2-letter ISO code (e.g. "US", "GB")
  if (t.length === 2 && /^[A-Za-z]{2}$/.test(t)) {
    return _codeToFlag(t);
  }

  // Full country name lookup (case-insensitive)
  const code = COUNTRY_NAME_TO_CODE[t.toLowerCase()];
  if (code) {
    // "UN" is not a real flag regional indicator — fall back to globe
    if (code === "UN") return "🌐";
    return _codeToFlag(code);
  }

  return "🌐";
}
