# Deployment (free tier: Render · Vercel · Neon · Redis · GitHub)

This project is designed to run on **hobby / free** tiers. Follow these rules to stay within limits and avoid sleep / quota surprises.

## Architecture

1. **Vercel (Next.js)** — Serves the UI. Proxies `/api/*` to the backend via `BACKEND_URL` in `next.config.ts`.  
2. **Render (FastAPI)** — One web service. Cold starts on free tier (~30–60s first request after idle).  
3. **Neon (PostgreSQL)** — Use the **pooled** connection string; the app already sets `channel_binding=disable` and uses `asyncpg` with `NullPool` where needed. Keep `db_pool_size` / `db_max_overflow` **low** (see `render.yaml` / `config.py`) to respect Neon connection limits.  
4. **Redis (Upstash or Render)** — **Optional**. If `REDIS_URL` is unset, the API uses in-memory cache (fine for a single small instance).  
5. **GitHub** — Source only; set secrets in Vercel and Render, never in the repo.

## Required environment variables

### Vercel (`frontend/` project)

| Variable | Example | Notes |
|----------|---------|--------|
| `NEXT_PUBLIC_API_BASE_URL` | `/api` | **Recommended.** Same-origin → no CORS for the viewer. Default in code is `/api` if unset. |
| `BACKEND_URL` | `https://your-service.onrender.com` | No trailing slash, no `/api` path. Used only by server rewrites. |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` | For metadata / OG. |

### Render (FastAPI `backend/`)

| Variable | Notes |
|----------|--------|
| `APP_ENV` | `production` |
| `DEBUG` | `false` |
| `DATABASE_URL` | Neon (or other Postgres) — **set in dashboard**, not committed |
| `JWT_SECRET_KEY` | Long random string (required in production) |
| `CORS_ORIGINS` | Comma-separated frontend origins, **no trailing slash** (include Vercel production and preview URLs if the browser calls the API with an absolute origin) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Defaults in repo/blueprint: `admin@test.com` / `Admin12345!` — **set the same in Render (and rotate in production if needed)**. |
| `REDIS_URL` | Optional; Upstash `rediss://` works |

When using **same-origin** `NEXT_PUBLIC_API_BASE_URL=/api` on Vercel, the browser does not need CORS for public reads; CORS still matters for **admin / auth** from a different origin or for tools hitting Render directly.

## Free-tier operational tips

- **Render sleep:** First request after idle is slow. Health checks in `render.yaml` help; users may still see cold start occasionally.  
- **Keep one Render worker** for scheduled jobs (avoid duplicate M3U syncs).  
- **Neon:** Use pooler host; do not open dozens of app instances without raising pool size.  
- **Vercel Hobby:** Build minutes and function limits apply; keep `vercel.json` to **headers only** (no fake static `outputDirectory` for Next App Router).  
- **Playwright on Render:** Chromium install is in the Render build command; free tier has limited RAM—do not run heavy browser pools in parallel.

## Health checks

- Backend: `GET /health`  
- Optional: `GET /health/db` (diagnostic; do not expose sensitive details in public dashboards)

## Local development

- Frontend: `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` in `.env.local`  
- Backend: `cp backend/.env.example backend/.env` and set `JWT_SECRET_KEY`, `DATABASE_URL` (or use SQLite for quick tests)  
- **Local admin login (matches `backend/.env.example`):** `admin@test.com` / `Admin12345!` — same pair should be set in **Render** (`ADMIN_*`) for production parity with Vercel.

---

*Last updated as part of the “free stack” hardening pass.*
