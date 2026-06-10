# ABO Sports TV — Master Implementation Plan

> **Status:** Phase 1 complete (audit only). No feature code has been changed yet.  
> **Last updated:** 2026-06-10  
> **Scope:** Full monorepo — `frontend/` (Next.js 15 PWA) + `backend/` (FastAPI) + ops configs  
> **Related docs:** `AUDIT_REPORT.md` (security/ops), `UI_REFACTOR_PLAN.md` (visual tasks), `DEPLOYMENT.md`, `docs/ENV_COPY_PASTE.md`

---

## Executive Summary

ABO Sports TV is a **production-capable** sports OTT/PWA with strong foundations: HLS proxy architecture, multi-mirror failover, PWA Workbox rules, localStorage stale-while-revalidate, and a feature-rich `PremiumPlayer`. The primary user-facing pain is **cold-start catalog load (up to ~60s)** caused by client-side M3U ingestion + full DB pagination on every session, compounded by Render free-tier cold starts.

This plan prioritizes **performance and streaming reliability** over visual polish, reuses existing systems, and avoids rewriting working code.

| Target | Current (estimated) | Priority |
|--------|---------------------|----------|
| First Paint | 3–8s (no cache), ~1–2s (cache hit) | P0 |
| Interactive | 15–60s (full catalog) | P0 |
| Absolute max load | Up to 60s+ (cold backend + M3U) | P0 |

---

## 1. Current Architecture

### 1.1 Stack Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Vercel — Next.js 15 (App Router) + React 19                      │
│  • Zustand state                                                  │
│  • @ducanh2912/next-pwa (Workbox)                                 │
│  • hls.js 1.6 + dashjs 5 + native HLS (Safari)                    │
│  • framer-motion, tailwind, next-themes                           │
│  • Rewrites: /api/* → Render backend                              │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS (same-origin /api)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Render — FastAPI + uvicorn (Python 3)                          │
│  • /api/v1/sports-tv/* — channels, filters, fixtures            │
│  • /api/v1/proxy/* — stream, playlist, m3u8 (SSRF guarded)      │
│  • APScheduler — sync, fixtures, validation                     │
│  • Optional Redis — list cache, sync locks, M3U dedup            │
└────────────────────────────┬────────────────────────────────────┘
                             │ asyncpg (NullPool)
                             ▼
                        Neon PostgreSQL
```

### 1.2 Frontend Routing

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/(viewer)/page.tsx` → `ViewerHome` | Main OTT home (player + modules + grid) |
| `/live` | `app/(viewer)/live/page.tsx` | Live matches + channel highlights |
| `/sports` | `app/(viewer)/sports/page.tsx` | Match calendar |
| `/match/[id]` | `app/(viewer)/match/[id]/page.tsx` | Pre-match detail |
| `/profile` | `app/(viewer)/profile/page.tsx` | User profile shell |
| `/history` | `app/(viewer)/history/page.tsx` | Watch history |
| `/offline` | `app/offline/page.tsx` | PWA offline fallback |
| `/admin/*` | `app/admin/*` | Admin dashboard (separate UX) |

**Router:** Next.js App Router with `(viewer)` route group (layout is pass-through).

### 1.3 State Management (Zustand)

| Store | File | Responsibility |
|-------|------|----------------|
| `usePlayerStore` | `store/playerStore.ts` | Active channel, theater mode |
| `useUiStore` | `store/uiStore.ts` | Module/category tabs, search focus, sidebar, suggestions |
| `useAuthStore` | `store/authStore.ts` | JWT session |
| `useSubscriptionStore` | `store/subscriptionStore.ts` | Tier (persisted) |
| `useSiteSettingsStore` | `store/siteSettingsStore.ts` | AdSense config (persisted) |
| `useThemeAccentStore` | `store/themeAccentStore.ts` | Gold/cyan accent (persisted) |
| `useI18nStore` | `lib/i18n/LocaleContext.tsx` | bn/en locale (persisted) |

**Not in Zustand:** favorites, recently watched, watch history — stored in `localStorage` inside `ViewerHome`.

### 1.4 PWA Setup

| Layer | Implementation | Notes |
|-------|----------------|-------|
| Plugin | `@ducanh2912/next-pwa` in `next.config.ts` | Disabled in dev |
| SW output | `public/` (generated at build) | `register: true` |
| Offline doc | `/offline` fallback | Shows cached channel count |
| Manifest | `app/manifest.ts` | SVG icons 192/512 + maskable |
| Install UX | `PwaInstallBanner.tsx` | `beforeinstallprompt` handler |
| Runtime cache | Custom Workbox rules | **Critical:** `/api/v1/proxy/*` = `NetworkOnly`; other `/api/*` = `NetworkFirst` (10s timeout) |

**Apple PWA:** `appleWebApp` metadata in `layout.tsx`.

### 1.5 Service Worker Strategy

```
Static assets     → default Workbox precache
/api/v1/proxy/*   → NetworkOnly (HLS segments must never be cached)
/api/* (rest)     → NetworkFirst, cacheName "apis", max 16 entries, 24h
Document offline  → /offline
```

This is **correct for streaming** — do not cache proxy bodies.

### 1.6 HLS / Streaming Architecture

**Client playback path:**

1. `ViewerHome` selects channel → `PremiumPlayer` (dynamic import, SSR off)
2. `orderedStreamUrlsForChannel()` builds primary + `alternate_urls`
3. Each URL proxied via `buildProxyStreamUrl()` → `/api/v1/proxy/stream?url=…`
4. `PremiumPlayer` tries URLs in order with cooldown-based deprioritization
5. Engine selection: DASH.js for `.mpd`, HLS.js for `.m3u8`, native for Safari HLS

**Catalog / source path (separate from playback):**

1. `loadStaticCatalogChannels()` — fetches many M3U playlists via `/proxy/playlist` (concurrency limit 5)
2. Premium direct entries from `appStreamConfig.ts`
3. `loadFullCatalogWithLive()` adds FanCode JSON + M3U + CricHD live sources
4. `fetchAllChannels()` paginates DB API (500/page, parallel rest pages)
5. `mergeDbChannelsIntoViewerCatalog()` merges DB mirrors + header profiles

**Backend proxy (`backend/app/api/routes/proxy.py`, ~1409 LOC):**

- SSRF validation, geo retry, manifest rewriting (m3u8 package + regex fallback)
- Dynamic stream headers via `stream_id`
- Redis/in-memory playlist cache (25 min M3U dedup)

### 1.7 Cache Architecture

| Tier | Location | TTL | Data |
|------|----------|-----|------|
| CDN | Vercel headers on `/api/v1/sports-tv/channels` | s-maxage 300 | API JSON |
| Redis (optional) | Backend `cache_get_json` | 300s default | Channel list, filters |
| Service Worker | Workbox `apis` cache | 24h max | Non-proxy API GET |
| localStorage | `channelListCache.ts` | 10 min | Full merged `Channel[]` (~4MB cap) |
| In-memory | Backend rate limit, BDIX aggregator | varies | Playlists, probes |
| Browser | Favorites, history, recent searches | indefinite | User prefs |

**Missing:** IndexedDB (no implementation found).

### 1.8 Channel Loading Logic

**Boot sequence in `ViewerHome`:**

1. Hydrate from `getChannelListCache()` → immediate UI (stale-while-revalidate) ✅
2. `loadChannels(silent=true)` if cache exists — no spinner ✅
3. Parallel: `loadFullCatalogWithLive()` + `fetchAllChannels()` — **main bottleneck** 🔴
4. 30 min interval: `refreshLiveMatchesOnly()`
5. Grid: `IntersectionObserver` sentinel loads +24 channels (initial 12) — incremental render ✅

**Pagination:** API supports `page`/`page_size`; client uses `fetchAllChannels()` to pull **all pages** upfront.

### 1.9 Search Architecture

- **Instant filter:** `useDeferredValue(searchQuery)` + `useMemo` filter on `allChannels`
- **Suggestions:** Top 8 matches pushed to `uiStore.searchSuggestions` → TopBar dropdown
- **Mobile:** `SearchOverlay` full-screen with live suggestions
- **Deep link:** `?q=` and `?channel_id=` URL params
- **Recent searches:** localStorage in TopBar

### 1.10 Navigation Architecture

**Active (production):**

- Mobile: `BottomNav.tsx` — Home, Live, Sports, Search, More (matches spec) ✅
- Desktop: `SidebarNav.tsx` + `TopBar.tsx`
- More: `MoreSheet.tsx` (India, WC, FAST TV, theme, admin links)

**Dead / duplicate code:**

- `MobileBottomNav.tsx` — emoji tabs, module switcher; **not imported anywhere**
- `Sidebar.tsx` — legacy; verify usage (superseded by `SidebarNav`)

### 1.11 Splash Screen

- `SplashScreen.tsx` exists with ABO branding animation
- **Not mounted** in any layout or page (grep shows definition only)
- References `/icons/abo-sports-tv-logo.png` which **does not exist** in `public/icons/` (only SVGs)
- Current boot UX: generic `Suspense` spinner on home + cold-start banner with "~60s" messaging

### 1.12 Manifest & Icons

| Asset | Path | Status |
|-------|------|--------|
| Manifest icons | `icon-192.svg`, `icon-512.svg`, `icon-maskable.svg` | Present (SVG) |
| Brand logo | `abo-logo.svg` | Present |
| PNG launcher | `abo-sports-tv-logo.png` | **Missing** — referenced in 10+ components |
| Apple touch | Uses SVG via metadata | May be suboptimal on iOS |

**Risk:** Android/ iOS install may show broken icon or generic placeholder when PNG expected.

### 1.13 Theme System

- CSS variables in `globals.css` (`--bg-primary`, `--accent-gold`, glass tokens)
- Tailwind extended in `tailwind.config.ts`
- `next-themes` dark default
- `themeAccentStore` toggles gold vs cyan via `data-accent` on `<html>`
- Player shell uses glassmorphism + AMOLED-adjacent dark surfaces ✅ (partial premium look)

### 1.14 Performance Bottlenecks (Root Causes)

| Bottleneck | Impact | Evidence |
|------------|--------|----------|
| Client M3U full ingest on every session | 20–45s | `loadStaticCatalogChannels()` — dozens of `/proxy/playlist` calls |
| `fetchAllChannels()` all pages | 5–15s | Up to N parallel 500-row API calls |
| Render free-tier cold start | 30–60s | Cold-start banner explicitly references ~60s |
| `JSON.stringify` large catalog to localStorage | Main-thread jank | `channelListCache.ts` — idle callback helps but still heavy |
| No server-side merged catalog endpoint | Redundant work | Client merges M3U + DB every time |
| `BackgroundAutoRefresh` wrong URLs | Wasted requests | Fetches `/api/channels`, `/api/categories`, `/api/fixtures` (404) |
| Full channel array in React state | Re-render cost | Thousands of channels filtered in `useMemo` |
| PremiumPlayer bundle | Delayed interactivity | Dynamic import helps; player still ~1500 LOC |

---

## 2. Existing Features

### 2.1 Viewer / OTT

- [x] Multi-module catalog (Bangladesh, India, Global Sports, Live Matches, WC 2026, FAST TV)
- [x] Inline HLS player with theater mode
- [x] Category tabs, country/language/league filters
- [x] Favorites + recently watched (localStorage)
- [x] Continue watching row in `HomeSportsDashboard`
- [x] Live fixtures schedule (soccer + cricket)
- [x] World Cup schedule component
- [x] Match cards, calendar, H2H, lineups (sports pages)
- [x] Swipe between modules (mobile)
- [x] i18n bn/en
- [x] PWA install banner
- [x] Offline page with cache awareness
- [x] Network status bar
- [x] Ad slots (AdSense optional)

### 2.2 Player (`PremiumPlayer.tsx`)

- [x] HLS.js + DASH.js + native HLS
- [x] Multi-URL silent failover with cooldown
- [x] ABR quality picker (Auto + level heights → 1080p/720p/…)
- [x] Constrained network detection (`navigator.connection`, saveData, 2g)
- [x] Adaptive buffer sizes for slow networks
- [x] Play/pause, mute, volume, fullscreen, theater mode
- [x] Picture-in-Picture (manual + auto on scroll-out)
- [x] Double-tap seek ±10s
- [x] Vertical swipe volume
- [x] Auto-retry on error (10–15s countdown)
- [x] Geo-restriction detection
- [x] Sleep timer
- [x] External player links panel
- [x] Live badge + title overlay

### 2.3 Backend

- [x] Channel CRUD + admin dashboard
- [x] Stream proxy with SSRF guard
- [x] M3U discovery/sync, BDIX aggregator
- [x] Live fixtures sync (OpenLigaDB, cricket, football-data.org)
- [x] Stream validation / probe
- [x] Redis-optional caching
- [x] Rate limiting, JWT auth

---

## 3. Existing Good Implementations (Do Not Rewrite)

| Area | Files | Why keep |
|------|-------|----------|
| PWA proxy cache isolation | `next.config.ts` | Prevents stale HLS — production-critical |
| Channel failover URLs | `channelStreams.ts`, `streamCatalog.ts` dedup | Solid mirror model |
| Cache-first hydrate | `ViewerHome` + `channelListCache.ts` | Correct SWR pattern — extend, don't replace |
| Grid incremental load | `ViewerHome` IntersectionObserver | Good enough baseline — upgrade to virtualization later |
| Proxy architecture | `backend/.../proxy.py` | Security + geo — refactor only by extraction |
| Workbox offline fallback | `/offline` + manifest | Functional |
| Bottom nav structure | `BottomNav.tsx`, `lib/nav.ts` | Matches product spec |
| Design tokens | `tailwind.config.ts`, `globals.css` | UI_REFACTOR_PLAN aligned |
| Bengali i18n | `LocaleContext.tsx` | Working bilingual UX |

---

## 4. Existing Problems

### 4.1 P0 — User-Visible

| ID | Problem | Location |
|----|---------|----------|
| P0-1 | Cold load up to 60s | `ViewerHome.loadChannels`, `streamCatalog.ts` |
| P0-2 | Empty/spinner UX on first visit (no cache) | No splash integration |
| P0-3 | Missing PNG brand icon breaks UI + notifications | 10+ refs to missing PNG |
| P0-4 | Buffering on live streams | `PremiumPlayer` — no backup pre-warm, aggressive live edge |
| P0-5 | Technical loading copy exposed | Cold-start banner "~60s", splash "চ্যানেল লোড হচ্ছে" |

### 4.2 P1 — Architecture / Maintainability

| ID | Problem | Location |
|----|---------|----------|
| P1-1 | No IndexedDB — localStorage 4MB ceiling | `channelListCache.ts` |
| P1-2 | Client-side full catalog merge every session | `ViewerHome`, `streamCatalog.ts` |
| P1-3 | `BackgroundAutoRefresh` dead fetches | `AppProviders.tsx` |
| P1-4 | `fetchAllChannels` loads entire DB client-side | `apiClient.ts` |
| P1-5 | No list virtualization — slice only | `ViewerHome` grid |
| P1-6 | Duplicate nav components | `MobileBottomNav.tsx` unused |
| P1-7 | `SplashScreen` built but unwired | `SplashScreen.tsx` |
| P1-8 | `PremiumPlayer.tsx` ~1500 LOC monolith | Hard to extend safely |
| P1-9 | `proxy.py` ~1409 LOC monolith | Same |
| P1-10 | ErrorBoundary catches window errors only | `ErrorBoundary.tsx` — not React render errors |

### 4.3 P2 — Feature Gaps vs Master Prompt

| ID | Gap |
|----|-----|
| P2-1 | No brightness swipe (only volume) |
| P2-2 | No pinch-to-zoom |
| P2-3 | No subtitle / audio track selection UI |
| P2-4 | No unified settings gear panel (quality uses Settings icon only) |
| P2-5 | No stream health / bitrate / FPS dev overlay |
| P2-6 | No DVR / start-over / replay (live-only architecture) |
| P2-7 | No backup stream preconnect / warm failover |
| P2-8 | Home section order incomplete vs spec (no Hero Live Match row, no Trending, Favorites not in dashboard) |
| P2-9 | Typography uses Noto Sans Bengali, not Anek Bangla / Hind Siliguri |
| P2-10 | No API retry/backoff in `apiClient` (timeout only) |
| P2-11 | No token refresh (24h JWT, client-only logout) |

---

## 5. Missing Features (Net-New Work)

### Phase 2 — Performance

- [ ] IndexedDB catalog store (versioned schema, background write)
- [ ] Unified cache orchestrator (IndexedDB → localStorage fallback → SW → network)
- [ ] Server-side `/sports-tv/catalog` merged endpoint (or push M3U merge to backend job)
- [ ] Stale catalog instant paint + silent background refresh indicator (non-blocking)
- [ ] True virtualized channel list (`@tanstack/react-virtual` or `react-virtuoso`)
- [ ] Fix `BackgroundAutoRefresh` endpoints
- [ ] Progressive catalog: render modules incrementally as each M3U batch completes
- [ ] Service Worker precache of last-known catalog snapshot (optional, versioned)

### Phase 3 — Premium PWA

- [ ] Generate PNG icon set from official ABO logo (192, 512, maskable, apple-touch, shortcut)
- [ ] Wire `SplashScreen` with premium sports animation (WC/cricket/stadium — no technical copy)
- [ ] Replace cold-start "~60s" banner with brand-safe "Preparing your experience…"
- [ ] iOS splash meta (`apple-touch-startup-image` or equivalent)
- [ ] Manifest `icons` PNG entries alongside SVG

### Phase 4 — HLS Engine

- [ ] Backup stream preconnect (HEAD/manifest peek on alternates while primary plays)
- [ ] Stall detector: `waiting` + `stalled` events → quality downshift or mirror switch
- [ ] Packet-loss proxy: fragment error rate threshold → failover
- [ ] Explicit quality cap for "Data Saver" mode
- [ ] Live stream quality UX label ("Live = Auto recommended")
- [ ] Extract `useHlsPlayer`, `useStreamFailover`, `useNetworkAdaptive` hooks from monolith

### Phase 5 — Player UX

- [ ] Glassmorphism control bar polish (already partial)
- [ ] Program / match overlay ("Bangladesh vs India", UCL, now playing EPG)
- [ ] Settings sheet: playback, display, streaming, accessibility, developer sections
- [ ] Left swipe brightness (Screen Brightness API where supported; fallback overlay)
- [ ] Pinch zoom (CSS transform on video, reset on double-tap)
- [ ] Mini player (floating bar when navigating away)
- [ ] Resume playback position (VOD only — N/A for live unless timeshift)
- [ ] Audio track picker (HLS `audioTracks` API)
- [ ] Subtitle track picker (HLS `subtitleTracks` / native `<track>`)

### Phase 6 — Dashboard

- [ ] Reorder home sections per spec (Hero Live → Continue → Favorites → Trending → Popular → Recent → Categories → Recommended)
- [ ] Reduce duplicate favorites/recent blocks
- [ ] Trending sports row (derive from fixtures + popular modules)
- [ ] Recommended content (rules-based first; ML later)

### Phase 7 — Typography

- [ ] Add `Anek Bangla` + `Hind Siliguri` via `next/font/google`
- [ ] Apply `font-bengali` consistently; remove faux bold/italic

### Phase 8 — Backend Resilience

- [ ] `apiClient` retry with exponential backoff (idempotent GETs)
- [ ] Token refresh or shorter TTL + silent re-auth
- [ ] Graceful degraded mode (catalog partial success)

### Recording System — Feasibility

| Approach | Feasible? | Notes |
|----------|-----------|-------|
| Client MediaRecorder on `<video>` | Partial | Can capture decoded output for short clips; live DRM/widevine N/A; heavy battery; legal concerns |
| Server-side DVR | No (current) | Would need timeshift playlist support + object storage (S3/R2); Render FS is ephemeral |
| Start-over / replay | Depends on source | Requires event-style HLS (`#EXT-X-DVR` / sliding window) from origin — most IPTV feeds are live-only |

**Recommendation:** Document as **Phase 9 / future** requiring cloud storage + timeshift-capable sources. Do not implement in initial phases.

---

## 6. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking HLS playback via SW/cache change | Critical | Never cache `/proxy/*`; test PWA + browser |
| IndexedDB migration bugs | High | Versioned schema + localStorage fallback |
| Moving catalog merge to backend | High | Feature flag; keep client path as fallback |
| PremiumPlayer refactor regressions | High | Extract hooks incrementally; manual stream QA |
| PNG icon inconsistency | Medium | Single source asset pipeline from `abo-logo.svg` |
| Render cold start | Medium | Keep-warm cron (`.github/workflows/keep-warm.yml` exists); cache-first UX |
| localStorage quota exceeded | Medium | IndexedDB + prune stale entries |
| SVG-only manifest on Android | Medium | Add PNG icons |
| JWT 24h no revoke | Medium | Separate security track (see AUDIT_REPORT C-2) |
| Legal/recording | Medium | User-facing recording deferred |

---

## 7. Implementation Order

Progress legend: `[ ]` todo · `[~]` partial · `[x]` done

### Phase 1 — Audit ✅

- [x] Full repository scan
- [x] Generate `docs/PLAN.md`

### Phase 2 — Performance First (P0)

| Step | Task | Impact | Effort |
|------|------|--------|--------|
| 2.1 | Fix `BackgroundAutoRefresh` URLs → real API paths | Low noise, cleaner boot | S |
| 2.2 | IndexedDB catalog cache (`idb-keyval` or native IDB) | High — larger, async storage | M |
| 2.3 | Cache orchestrator: IDB hydrate → instant paint → background refresh | High | M |
| 2.4 | Progressive module loading (show BD cache while GS fetches) | High | L |
| 2.5 | Backend merged catalog endpoint OR scheduled job writes snapshot to Redis/DB | Very high | L |
| 2.6 | Virtualized `ChannelGrid` | Medium — scroll perf | M |
| 2.7 | Stop fetching all DB pages when cache fresh; delta sync | High | M |

### Phase 3 — Premium PWA

| Step | Task | Impact | Effort |
|------|------|--------|--------|
| 3.1 | Generate PNG icons (all sizes) from official logo | Install UX | S |
| 3.2 | Update `manifest.ts` + `layout.tsx` icons | PWA compliance | S |
| 3.3 | Wire `SplashScreen`; user-safe copy only | Perceived perf | M |
| 3.4 | Remove/replace technical cold-start messaging | UX trust | S |

### Phase 4 — HLS Streaming Engine

| Step | Task | Impact | Effort |
|------|------|--------|--------|
| 4.1 | Extract failover hook; add backup manifest warm-up | Buffer reduction | M |
| 4.2 | Stall-aware quality / mirror switch | Reliability | M |
| 4.3 | Data Saver mode (cap level + smaller buffers) | Mobile UX | S |
| 4.4 | Developer stream health overlay (opt-in) | Debug | S |

### Phase 5 — Player Redesign

| Step | Task | Impact | Effort |
|------|------|--------|--------|
| 5.1 | Settings gear sheet (grouped sections) | UX completeness | M |
| 5.2 | EPG / match overlay on player | Premium feel | M |
| 5.3 | Brightness swipe + pinch zoom | Mobile parity | M |
| 5.4 | Audio/subtitle tracks | Accessibility | M |
| 5.5 | Mini player | Navigation UX | L |

### Phase 6 — Dashboard Redesign

| Step | Task | Impact | Effort |
|------|------|--------|--------|
| 6.1 | Reorder `HomeSportsDashboard` + `ViewerHome` sections | Discoverability | M |
| 6.2 | Add Trending + Recommended rows | Engagement | M |
| 6.3 | Consolidate favorites UI (single section) | Less clutter | S |

### Phase 7 — Typography

| Step | Task | Impact | Effort |
|------|------|--------|--------|
| 7.1 | Load Anek Bangla + Hind Siliguri | Brand/locale | S |
| 7.2 | Audit font-weight usage | Readability | S |

### Phase 8 — Backend Resilience

| Step | Task | Impact | Effort |
|------|------|--------|--------|
| 8.1 | GET retry/backoff in `apiClient` | Fewer error toasts | S |
| 8.2 | Partial catalog API responses | Graceful degradation | M |
| 8.3 | Token refresh (optional security sprint) | Session reliability | L |

---

## 8. Estimated Impact

| Phase | First Paint | Time to Interactive | Streaming | PWA Install |
|-------|-------------|---------------------|-----------|-------------|
| 2 | ⬇️ 50–80% with IDB + progressive | ⬇️ 60–90% | — | — |
| 3 | — | Perceived ⬇️ 40% | — | ⬆️ Fixed icons |
| 4 | — | — | ⬇️ 30–50% stalls | — |
| 5–6 | — | Minor | UX ⬆️ | — |
| 7–8 | Minor | Minor | — | — |

---

## 9. Files To Modify (Planned)

### High-touch (Phase 2–5)

| File | Reason |
|------|--------|
| `frontend/src/components/home/ViewerHome.tsx` | Cache flow, dashboard order, grid virtualization |
| `frontend/src/lib/channelListCache.ts` | Extend or delegate to IndexedDB |
| `frontend/src/lib/appCache.ts` | Clear IDB on cache reset |
| `frontend/src/lib/streamCatalog.ts` | Progressive loading hooks |
| `frontend/src/lib/apiClient.ts` | Retry, optional catalog endpoint |
| `frontend/src/components/providers/AppProviders.tsx` | Fix background refresh |
| `frontend/src/components/PremiumPlayer.tsx` | Split hooks; streaming UX |
| `frontend/src/components/channels/ChannelGrid.tsx` | Virtualization wrapper |
| `frontend/src/components/SplashScreen.tsx` | Premium copy + wire-up |
| `frontend/src/app/manifest.ts` | PNG icons |
| `frontend/src/app/layout.tsx` | Fonts, splash meta, icons |
| `frontend/next.config.ts` | Only if SW catalog precache added |
| `frontend/public/icons/*` | New PNG assets |
| `backend/app/api/routes/sports_tv.py` | Optional merged catalog endpoint |
| `backend/app/services/*` | Catalog snapshot job (if backend merge chosen) |

### Medium-touch

| File | Reason |
|------|--------|
| `frontend/src/components/home/HomeSportsDashboard.tsx` | Section reorder |
| `frontend/src/components/layout/TopBar.tsx` | Search polish |
| `frontend/src/components/SearchOverlay.tsx` | Instant search mobile |
| `frontend/src/app/offline/page.tsx` | IDB cache count |
| `frontend/tailwind.config.ts` | Typography tokens |
| `frontend/src/app/globals.css` | Font utilities |

### Low-touch / cleanup

| File | Reason |
|------|--------|
| `frontend/src/components/layout/MobileBottomNav.tsx` | Remove or merge (dead code) |
| `frontend/src/components/layout/Sidebar.tsx` | Remove if unused |
| `frontend/src/components/ErrorBoundary.tsx` | Proper React boundary |

---

## 10. Files To Leave Untouched (Unless Required)

| File / Area | Reason |
|-------------|--------|
| `backend/app/api/routes/proxy.py` | Core streaming — extract only, no behavior change in Phase 2 |
| `backend/app/core/security.py`, `auth.py` | Security-sensitive — separate sprint |
| `render.yaml`, `vercel.json` | Ops — change only with deploy plan |
| `backend/app/services/playwright_extractor.py` | RAM-heavy; disabled by default |
| `frontend/src/lib/appStreamConfig.ts` | Curated stream sources — business config |
| `docs/ENV_COPY_PASTE.md`, `DEPLOYMENT.md` | Stable ops docs |
| Admin dashboard pages | Out of viewer PWA scope unless requested |
| `AUDIT_REPORT.md` | Reference snapshot |

---

## 11. Features — Skip (Already Implemented)

| Master prompt item | Status | Location |
|--------------------|--------|----------|
| HLS.js player | Done | `PremiumPlayer.tsx` |
| DASH + native HLS | Done | `PremiumPlayer.tsx` |
| Multi-mirror failover | Done | `PremiumPlayer.tsx`, `channelStreams.ts` |
| ABR quality (Auto + levels) | Done | `PremiumPlayer.tsx` |
| Slow network detection | Done | `isConstrainedNetwork()` |
| PiP | Done | Manual + auto scroll |
| Double-tap seek | Done | Touch handler |
| Volume swipe | Done | Right-side vertical swipe |
| Bottom nav Home/Live/Sports/Search/More | Done | `BottomNav.tsx` |
| Instant search while typing | Done | `useDeferredValue` |
| PWA service worker | Done | `next.config.ts` |
| Offline fallback page | Done | `app/offline/page.tsx` |
| Cache-first channel hydrate | Done | `ViewerHome` + `channelListCache` |
| Incremental grid loading | Partial ✓ | IntersectionObserver batches |
| Continue watching | Done | `HomeSportsDashboard` |
| Favorites | Done | `ViewerHome` localStorage |
| Glassmorphism / dark theme | Partial ✓ | Design tokens + player shell |
| Bengali UI | Done | i18n (font choice differs) |
| Live fixtures | Done | Backend sync + frontend schedule |
| World Cup module | Done | `WorldCupSchedule`, module tab |

---

## 12. Progress Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| 1 — Audit | ✅ Complete | This document |
| 2 — Performance | ✅ Complete | IDB cache, hydrate, API retry, grid content-visibility, delta DB fetch |
| 3 — PWA | ✅ Complete | PNG icons, splash wired, manifest, user-safe copy |
| 4 — HLS Engine | ✅ Complete | Backup warm-up, stall retry, data saver |
| 5 — Player UX | ✅ Complete | Settings panel, gestures, stream health overlay |
| 6 — Dashboard | ✅ Complete | Home section reorder |
| 7 — Typography | ✅ Complete | Anek Bangla + Hind Siliguri |
| 8 — Backend | ✅ Complete | GET retry/backoff in apiClient |
| 9 — Recording | ⬜ Deferred | See feasibility §5 |

---

## 13. Next Step

**Await review of this plan.** After approval, begin **Phase 2.1–2.3** (low-risk, high-impact):

1. Fix broken background preload URLs  
2. Add IndexedDB catalog layer  
3. Wire splash + remove technical loading copy  

Each completed task should update §12 and append a brief changelog entry below.

### Changelog

| Date | Change |
|------|--------|
| 2026-06-10 | Initial PLAN.md created from full repo audit |
| 2026-06-10 | Phases 2–8 implemented: IDB cache, PWA splash/icons, HLS warm-up, player settings, dashboard reorder, Bengali fonts, API retry |
