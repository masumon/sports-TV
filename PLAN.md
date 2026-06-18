# UI/UX Audit Plan — 2026-06-18
**Scope:** Mobile Player Overlay · Footer · Channel Cards · World Cup Priority · Search UX  
**Status:** ⏸ AWAITING APPROVAL — no files changed yet

---

## Findings by Severity

### 🔴 HIGH

| # | File | Line | Issue | Impact |
|---|------|------|-------|--------|
| H1 | `bdPriority.ts` | 11–23 | **DD Sports missing from Group A** — task explicitly requires it | BD viewers miss India's national broadcaster at top of grids |

---

### 🟠 MEDIUM

| # | File | Line | Issue | Impact |
|---|------|------|-------|--------|
| M1 | `SearchOverlay.tsx` | 138 | `object-cover` on search result logos — clips broadcast logos (T Sports, GTV, Star Sports) | Channel logos distorted in search results |
| M2 | `SiteFooter.tsx` | 120–153 | Coverage chips (zone 3) + Browse CTA (zone 4) are two separate padded sections — easily one row | ~20px footer height waste |
| M3 | `ChannelGrid.tsx` | 34 | Mobile grid starts at `grid-cols-2` — 64px logo in ~189px card leaves huge dead space | Poor density; fewer channels visible without scroll |
| M4 | `PremiumPlayer.tsx` | 1600 | Settings panel `w-52` (208px) — on 320px screens leaves only 112px free | Minor clipping on smallest phones |

---

### 🟡 LOW

| # | File | Line | Issue | Impact |
|---|------|------|-------|--------|
| L1 | `SiteFooter.tsx` | 156 | Legal row has no `env(safe-area-inset-bottom)` padding | Privacy/Terms links hidden behind iOS home bar |
| L2 | `bdPriority.ts` | 25–32 | Group B missing `"ipl"`, `"bpl"`, `"t20"` cricket tournament keywords | BD-relevant events ranked lower than generic channels |
| L3 | `SearchOverlay.tsx` | 99 | Close (X) button is `p-2` + icon ≈ 36px — below 44px touch target minimum | Fat-finger misses on mobile |

---

## Proposed Fixes

### H1 — Add DD Sports to Group A
**File:** `frontend/src/lib/bdPriority.ts`  
Add `"dd sports"` to `GROUP_A` array after `"gtv"`. One line.

### M1 — Fix logo distortion in Search
**File:** `frontend/src/components/SearchOverlay.tsx` line 138  
`object-cover` → `object-contain`. One-word change.

### M2 — Merge coverage chips + Browse CTA into one row
**File:** `frontend/src/components/SiteFooter.tsx` zones 3+4  
Collapse two `<div>` sections into one `flex items-center justify-between` row.  
Chips on left, Browse CTA on right. Saves one padding section (~20px height).

### M3 — Mobile grid 2→3 columns
**File:** `frontend/src/components/ChannelGrid.tsx` line 34  
`grid-cols-2` → `grid-cols-3`. Rest unchanged (`sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`).

### M4 — Settings panel width clamp
**File:** `frontend/src/components/PremiumPlayer.tsx` line 1600  
`w-52` → `w-48 max-w-[calc(100vw-1.5rem)]`. Prevents overflow on 320px screens.

### L1 — Footer safe-area-inset-bottom
**File:** `frontend/src/components/SiteFooter.tsx` line 156  
Add `style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}` to the legal row div.

### L2 — Expand Group B keywords
**File:** `frontend/src/lib/bdPriority.ts`  
Add `"ipl"`, `"bpl"`, `"t20"` to `GROUP_B`.

### L3 — Search close button touch area
**File:** `frontend/src/components/SearchOverlay.tsx` line 99  
`p-2` → `p-2.5` to expand hit area to ~44px.

---

## Files to Change

| File | Change | Risk |
|------|--------|------|
| `frontend/src/lib/bdPriority.ts` | +4 array items (H1 + L2) | Zero |
| `frontend/src/components/SearchOverlay.tsx` | 2 lines (M1 + L3) | Zero |
| `frontend/src/components/SiteFooter.tsx` | ~12 lines (M2 + L1) | Low |
| `frontend/src/components/ChannelGrid.tsx` | 1 line (M3) | Low |
| `frontend/src/components/PremiumPlayer.tsx` | 1 line (M4) | Zero |

**Not touched:** HLS/DASH/stream/playback logic, API, DB, auth, routing, SEO, PWA, backend.

---

## Validation Plan

- [ ] `tsc --noEmit` — zero errors
- [ ] Search logos render without crop (object-contain)
- [ ] DD Sports appears at top of BD-sorted channel grids
- [ ] Footer: one row for chips + CTA, all links still work
- [ ] Mobile grid shows 3 columns
- [ ] Settings panel doesn't overflow on narrow screens
- [ ] All player controls still functional
- [ ] iOS home bar no longer hides legal links
- [ ] No backend / playback changes

---

## ⏸ STOP — WAITING FOR APPROVAL
