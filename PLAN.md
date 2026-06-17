# ABO Sports TV — OTT UX Polish Pass

Date: 2026-06-17  
Branch: `claude/world-cup-2026-loading-fix-bKags`  
Scope: UI/UX only — no backend, no API, no functional changes

---

## Phase 1 — Audit Findings

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | Empty state `py-16` = 64px dead space — kills information density | High | ChannelGrid.tsx |
| 2 | Grid gap: 12px mobile→lg, only 16px on xl (no intermediate step) | Medium | ChannelGrid.tsx |
| 3 | Empty state text oversized (`text-base`) vs tight list (`text-xs`) — hierarchy mismatch | Medium | ChannelGrid.tsx |
| 4 | Card padding `p-3.5` + `gap-2.5` — 2px oversized; wastes vertical card space on mobile | Medium | ChannelCard.tsx |
| 5 | Live/VPN badge offset `-0.5` (−2px) — clips on some renderers | Low | ChannelCard.tsx |
| 6 | Module tab strip `pb-1` — no visual separation between tabs and content | Medium | ViewerHome.tsx |
| 7 | MoreSheet theme buttons `py-3` — 24px height for 20px color swatch; wasted touch area | Medium | MoreSheet.tsx |
| 8 | MoreSheet `mb-4/mb-5` between 10px typography — gap twice the text height | Medium | MoreSheet.tsx |
| 9 | Admin stat grid: `gap-3` flat on all breakpoints | Low | dashboard/page.tsx |
| 10 | Footer already optimized (previous pass) | — | SiteFooter.tsx |

**Not changed this pass (risk/scope):**
- `PremiumPlayer.tsx` — playback logic intertwined with control UI; breaking change risk
- `globals.css` — design token classes already consistent
- `SearchOverlay` — functioning correctly; no density issues
- All backend/API/auth/analytics files

---

## Phase 2 — Home Screen

**File:** `ViewerHome.tsx`  
**Change:** Module tab strip `pb-1` → `pb-2`  
**Effect:** +4px visual breathing room between tab row and first content block; clearer hierarchy

---

## Phase 3 — Player

Deferred. PremiumPlayer.tsx contains intertwined playback + control logic.  
Safe player UX changes (button sizing, fullscreen polish) would require a dedicated isolated pass.

---

## Phase 4 — Channel Experience

**File:** `ChannelCard.tsx`

| Property | Before | After |
|----------|--------|-------|
| Card padding | `p-3.5` (14px) | `p-3` (12px) |
| Logo-to-name gap | `gap-2.5` (10px) | `gap-2` (8px) |
| Live badge offset | `-right-0.5 -top-0.5` | `right-0 top-0` |
| VPN badge offset | `-bottom-0.5` | `bottom-0` |

**File:** `ChannelGrid.tsx`

| Property | Before | After |
|----------|--------|-------|
| lg breakpoint gap | `gap-3` (12px) | `lg:gap-3.5` (14px) |
| Empty state padding | `py-16 px-6` (64px/24px) | `py-10 px-5` (40px/20px) |
| Empty state icon | `h-14 w-14` | `h-12 w-12` |
| Empty state heading | `text-base` | `text-sm` |
| Empty state subtitle | `mt-1.5 text-sm` | `mt-1 text-xs` |
| Empty state list top margin | `mt-2` | `mt-1.5` |

---

## Phase 5 — Search

No changes. Search overlay has correct hierarchy and mobile usability.

---

## Phase 6 — Admin Dashboard

**File:** `dashboard/page.tsx`  
**Change:** Stat grid `gap-3` → `gap-3 sm:gap-4`  
**Effect:** Cards have breathing room on tablet and wider

---

## Phase 7 — Design System

No changes to `globals.css`. Existing token classes (`.module-tab`, `.cat-tab`, `.admin-stat`, `.live-badge`, `.glow-gold`, `.neon-border`, `.interactive-transition`) are already consistent.

---

## Phase 8 — Mobile-First Polish

**File:** `MoreSheet.tsx`

| Element | Before | After |
|---------|--------|-------|
| Drag handle row | `mb-4` | `mb-2` |
| Theme picker buttons | `py-3` | `py-2` |
| Post-picker gap | `mb-5` | `mb-3` |
| All Channels button | `mb-3` | `mb-2` |
| Profile link | `mb-5` | `mb-2` |
| Footer section top | `pt-4` | `pt-3` |
| Developer card top | `mt-3` | `mt-2` |

Net savings: ~28px vertical space in a modal that's capped at `92dvh` on mobile.

---

## Validation

- `npx tsc --noEmit` — 0 errors  
- No backend files touched  
- No routing changes  
- No link changes  
- No playback logic changes  
- No analytics changes  
