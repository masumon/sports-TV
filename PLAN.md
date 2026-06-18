# Footer Redesign Audit
**Scope:** SiteFooter.tsx only
**Date:** 2026-06-18
**Used in:** frontend/src/app/layout.tsx (line 145) — shared across ALL pages

---

## CURRENT vs TARGET

### Current Footer Structure
```
Zone 1 — Brand (horizontal flex, py-3)
  [Logo] [ABO SPORTS TV LIVE]
         [LIVE] [10K+ Channels]

Zone 2 — Quick Actions (py-2.5)
  [FB] [TG] [WA] [YT] [✉] [☎]  — 6 × h-10 w-10 icon buttons

Zone 3 — Coverage + Browse CTA (py-2.5, single row)
  [⚽ Football] [🏏 Cricket] [🏀 Basketball] [🎾 Tennis] [🏎️ F1] [🥊 Boxing]  [Browse All →]
  ↑ 6 chips with full text labels                                                ↑ inline chip ml-auto

Zone 4 — Legal + Attribution (py-2, single row)
  Privacy · Terms · License · Intl.Use        Powered by ABO Enterprise 🔗
```

### Target Footer Structure
```
Zone 1 — Brand
  [Logo]  ABO SPORTS TV LIVE  [LIVE] [10K+]

Zone 2 — Quick Actions
  [FB] [TG] [WA] [YT] [✉] [☎]

Zone 3 — Coverage chips  ← emoji only, 4 sports
  ⚽  🏏  🎾  🏀

Zone 4 — Browse CTA  ← own dedicated line
  ⭐ Browse Channels →

Zone 5 — Legal  ← 3 links, • separator
  Privacy • Terms • License

Zone 6 — Attribution  ← no "Powered by" prefix
  ABO Enterprise
```

---

## FINDINGS

| # | Severity | Line(s) | Issue | Target | Risk |
|---|----------|---------|-------|--------|------|
| F1 | MEDIUM | 35–38 | Coverage: 6 chips with full text labels ("⚽ Football" etc.). Target wants 4 emoji-only chips (⚽ 🏏 🎾 🏀). | Replace text labels with emoji-only, trim to 4 sports | None |
| F2 | MEDIUM | 139–147 | Browse CTA is inline with coverage chips using `ml-auto`. Target wants it on its own dedicated line below coverage. | Move to separate zone between coverage and legal | None |
| F3 | LOW | 157–164 | Legal row has 4 links (Privacy · Terms · License · Intl.Use) with `·` separator. Target has 3 links with `•` separator. | Remove Intl.Use link, change separator to `•` | None |
| F4 | LOW | 165–177 | Attribution shows "Powered by **ABO Enterprise** 🔗". Target shows just "ABO Enterprise" as a cleaner link. | Remove "Powered by" prefix and ExternalLink icon | None |
| F5 | INFO | 62–94 | Brand area is horizontal flex (logo left, text right). Target wireframe shows stacked/centered. Current layout is compact and functional — no change needed. | Keep as-is | — |

---

## PROPOSED FINAL LAYOUT

```
┌─────────────────────────────────────────────────────────┐
│ [Logo] ABO SPORTS TV LIVE  [LIVE]  [10K+]   py-3       │  Zone 1 — Brand (unchanged)
├─────────────────────────────────────────────────────────┤
│ [FB]  [TG]  [WA]  [YT]  [✉]  [☎]           py-2.5    │  Zone 2 — Quick Actions (unchanged)
├─────────────────────────────────────────────────────────┤
│ [⚽]  [🏏]  [🎾]  [🏀]                      py-2      │  Zone 3 — Coverage (emoji-only, 4 chips)
├─────────────────────────────────────────────────────────┤
│ ⭐ Browse Channels →                         py-1.5    │  Zone 4 — Browse CTA (own line)
├─────────────────────────────────────────────────────────┤
│ Privacy • Terms • License       ABO Enterprise py-2    │  Zone 5+6 — Legal + Attribution merged
└─────────────────────────────────────────────────────────┘
```

**Estimated mobile height: ~170px** (vs current ~190px — marginal further gain)

---

## FILES TO MODIFY

| File | Changes |
|------|---------|
| `frontend/src/components/SiteFooter.tsx` | F1–F4 only |

## DO NOT TOUCH
Backend · API · Auth · Analytics · Routing · SEO · PWA · Playback  
All URLs · mailto · tel · legal PDF links

## VALIDATION
1. `tsc --noEmit` — zero errors
2. `next build` — pass
3. All 6 social/contact icons functional
4. Browse Channels link → `/`
5. Privacy/Terms/License links open correct PDFs
6. ABO Enterprise link opens developer URL
