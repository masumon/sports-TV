/**
 * Bangladesh audience priority scoring for channel lists.
 *
 * Group A — preferred broadcaster names: score 0 (top)
 * Group B — sports/event keywords:        score 1
 * Everything else:                        score 2
 *
 * Matching is case-insensitive substring so "T Sports HD", "Star Sports 1", etc. all match.
 */

const GROUP_A: readonly string[] = [
  "t sports",
  "gtv",
  "star sports",
  "sony sports",
  "sports18",
  "ten sports",
  "ptv sports",
  "astro cricket",
  "willow",
  "sky sports",
  "supersport",
];

const GROUP_B: readonly string[] = [
  "world cup",
  "cricket",
  "football",
  "fifa",
  "uefa",
  "sports",
];

/** Returns 0 (Group A), 1 (Group B), or 2 (other). Lower = higher priority. */
export function bdPriorityScore(name: string): number {
  const lower = name.toLowerCase();
  if (GROUP_A.some((n) => lower.includes(n))) return 0;
  if (GROUP_B.some((kw) => lower.includes(kw))) return 1;
  return 2;
}

/** Stable sort: priority channels first, original order preserved within each tier. */
export function sortByBdPriority<T>(list: T[], getName: (c: T) => string): T[] {
  return [...list].sort((a, b) => bdPriorityScore(getName(a)) - bdPriorityScore(getName(b)));
}
