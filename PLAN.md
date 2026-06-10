# ABO SPORTS TV — Fix Plan (SSOT)

Status: COMPLETE (pending deploy env verification)

## Phase 0 — Security (P0)
- [x] proxy: re-validate URLs after redirects (SSRF)
- [x] proxy: upstream TLS verify default on (`STREAM_UPSTREAM_TLS_VERIFY`)
- [x] sports_tv: auth-gate POST /invalidate-cache (admin JWT)
- [x] auth: hide reset_token in production
- [x] aggregator: require INTERNAL_SYNC_SECRET in prod for bdix/sync
- [x] auth: disable open registration in production
- [x] prod: disable OpenAPI /docs

## Phase 1 — Player UX (P0/P1)
- [x] Remove duplicate LIVE/channel chrome (Hero badge when player active, strip simplified)
- [x] LiveStatsOverlay via PremiumPlayer overlay prop
- [x] Live mode: disable seek gestures + hide empty buffer bar
- [x] Cap auto-retry (3×)
- [x] /live: explicit match preview label (no fake stream)

## Phase 2 — Fake data / broken preload (P1)
- [x] match/[id]: remove mock H2H/lineups; honest message
- [x] AppProviders: fix BackgroundAutoRefresh API paths
- [x] subscription: remove client toggleTier abuse path

## Phase 3 — Backend reliability (P1/P2)
- [x] config defaults align with render.yaml
- [x] admin sync: wire check_sync_allowed()
- [x] sports_tv: geo-sort before pagination (SQL + cache key)
- [x] admin channels: pagination (apiClient loads all pages)

## Phase 4 — Cleanup (P2/P3)
- [x] history page: ViewerPageShell
- [x] GitHub CI workflow (lint/build)

## Phase 5 — Validate & Ship
- [x] frontend lint + build
- [x] backend compileall
- [ ] commit + push

## Manual actions (user)
- Render: set `JWT_SECRET_KEY`, `INTERNAL_SYNC_SECRET`, `DATABASE_URL`, rotate `ADMIN_PASSWORD`
- Vercel: confirm `BACKEND_URL=https://gstv-backend.onrender.com`
- Prod admin password reset: token no longer in API response — use dev/staging or add email delivery
- If streams fail TLS: set `STREAM_UPSTREAM_TLS_VERIFY=false` on Render (last resort)
