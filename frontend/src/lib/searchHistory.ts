const SEARCH_HISTORY_KEY = "gstv-search-history";
const MAX_HISTORY = 20;

export function getSearchHistory(): string[] {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function addSearchHistory(query: string): void {
  const normalized = query.trim();
  if (!normalized) return;

  try {
    const history = getSearchHistory();
    const filtered = history.filter((h) => h.toLowerCase() !== normalized.toLowerCase());
    const updated = [normalized, ...filtered].slice(0, MAX_HISTORY);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
}

export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    /* ignore */
  }
}
