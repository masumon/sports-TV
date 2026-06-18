# OTT UX Audit — Mobile Player Overlay + Footer
**Scope:** PremiumPlayer.tsx · SiteFooter.tsx only
**Date:** 2026-06-18
**Branch:** fix/mobile-overlay-footer-premium

---

## PLAYER FINDINGS (PremiumPlayer.tsx)

| # | Severity | Line(s) | Problem | Proposed Fix | Risk |
|---|----------|---------|---------|-------------|------|
| P1 | **HIGH** | 1358–1418 | Top bar: with `onBack` prop, 5 icon buttons (Back+Lock+AspectRatio+Fullscreen+Settings) + channel info = ~268px on 360px → only ~92px left for title, truncates to ~6 chars. | Hide AspectRatio on mobile (`hidden sm:inline-flex`) + add it to Settings › Video tab. Functionality preserved via settings. | Low |
| P2 | **HIGH** | 1600 | Settings panel `top-16` (64px fixed). On notch phones `safe-area-inset-top` ≈ 47px → top bar height ≈ 91px → settings panel opens 27px INSIDE the top bar. Controls overlap. | Change `top-16` to inline style: `calc(max(4rem, env(safe-area-inset-top, 0px) + 2.75rem))` | Low — CSS only |
| P3 | LOW | 1486–1489 | Sleep timer badge `absolute -top-1 -right-1` on button at `right-3` (12px from edge) — badge clips to 8px from player edge, may be hidden on rounded containers. | Change badge to `-top-1 -right-0.5` | None |
| P4 | INFO | 1303–1313 | Tap hint (z-30) and LIVE badge (z-30) share same z-index. Both can show simultaneously but occupy different areas (center vs top-left). No visual collision. | No action needed. |

---

## FOOTER FINDINGS (SiteFooter.tsx)

**Measured mobile height (bdExpanded=true): ≈ 500px**
**Target (35–50% reduction): 250–325px**

| # | Severity | Line(s) | Problem | Proposed Fix | Saves | Risk |
|---|----------|---------|---------|-------------|-------|------|
| F1 | **HIGH** | 144–146 | Product description `<p>` text duplicates the 4 chips below AND the hero badges. Pure redundancy. | Remove the `<p>` description entirely. | ~32px | None |
| F2 | **HIGH** | 85–87 | Hero tagline "Global live sports & Bangladesh TV — one app." is self-evident, adds ~16px. | Remove tagline `<p>`. | ~16px | None |
| F3 | **HIGH** | 97–105 | Hero badge "HLS · PWA · HD" duplicates Product chips (HLS, PWA, Multi-region, HD) exactly. | Remove "HLS · PWA · HD" badge, keep LIVE pill + "10,000+ Channels" only. | ~10px + clutter | None |
| F4 | **MEDIUM** | 222–263 | "Powered by" strip (py-2) + Legal bar (py-2) = two separate rows ≈ 60px. | Merge into one compact flex row: `[Powered by …] · [Privacy · Terms · License · Intl. Use] · [© year]` | ~28px | Low |
| F5 | **MEDIUM** | 203–208 | Coverage: 8 chips → 2 rows on mobile (~44px). First 5 are the key sports. | Hide last 3 chips on mobile (`hidden sm:inline-flex`). All 8 visible on ≥640px. | ~22px | None |
| F6 | **MEDIUM** | 137 | Grid is `grid-cols-1` on mobile — 3 full-width stacked sections ≈ 240px. | Use `grid-cols-2 lg:grid-cols-3` — Product+Contact side-by-side on mobile, Coverage below. | ~80px | Low |
| F7 | LOW | 140,157,199 | `space-y-2` (8px) in all 3 sections. | Reduce to `space-y-1.5` (6px) in all 3 sections. | ~12px | None |
| F8 | LOW | 135 | Grid `py-4` on mobile (16px top+bottom). | Change to `py-3 sm:py-4`. | ~8px | None |

**Projected total savings: ~208px → footer ≈ 292px (42% reduction) ✓**

---

## FILES TO MODIFY

| File | Fixes |
|------|-------|
| `frontend/src/components/PremiumPlayer.tsx` | P1, P2, P3 |
| `frontend/src/components/SiteFooter.tsx` | F1–F8 |

## DO NOT TOUCH
Playback logic · HLS · DASH · stream URLs · backend · API · auth · analytics  
SearchOverlay · ChannelCard · ChannelGrid · MoreSheet · TopBar · InsightsDashboard  
Legal PDF links · social URLs · email · phone actions

## VALIDATION
1. `tsc --noEmit` — zero errors
2. `next build` — pass
3. Player: 320px / 360px / 375px / 390px viewport checks
4. Footer: height at each breakpoint
5. Regression: all settings options reachable; all footer links present
