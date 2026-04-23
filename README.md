# Global Sports Live TV

Monorepo for a **global sports live TV** experience: **FastAPI** backend (channels, live scores, JWT admin, IPTV M3U sync) and **Next.js 15** frontend (HLS player, score overlay, **PWA**).  
Live frontend example: [sports-tv-lovat.vercel.app](https://sports-tv-lovat.vercel.app/)

---

## Architecture

| Layer | Stack | Role |
|--------|--------|------|
| Frontend | Next.js 15 (App Router), Tailwind, Zustand, Framer Motion | Viewer UI, admin UI, PWA install |
| Backend | FastAPI, SQLAlchemy, Neon/PostgreSQL or SQLite | REST API under `/api/v1`, CORS-aware |
| Streams | Public M3U sources (e.g. iptv-org sports) | Ingested via admin **Sync IPTV M3U** |

Data flow: browser → `NEXT_PUBLIC_API_BASE_URL` → `GET /api/v1/sports-tv/channels`, `GET /api/v1/live-scores`, admin routes with `Authorization: Bearer …`.

---

## Quick start (local)

**Backend**

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend**

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

- API docs: `http://localhost:8000/docs`  
- App: `http://localhost:3000`  
- Admin: `http://localhost:3000/admin/login`

---

## Production: Vercel (frontend) + Render (backend)

1. **Render — Web Service**  
   - Connect this repo, set **Root Directory** to `backend`.  
   - **Build:** `pip install -r requirements.txt`  
   - **Start:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`  
   - Set env vars (see `backend/.env.example`). **Never commit real secrets.**  
   - Optional: use repo `render.yaml` as a blueprint and fill `sync: false` secrets in the dashboard.

2. **Vercel — Next.js**  
   - Import repo, **Root Directory** `frontend`.  
   - **Environment variables:**
     - `NEXT_PUBLIC_API_BASE_URL` = your Render service URL **without** trailing slash (no `/api/v1` suffix).
     - `NEXT_PUBLIC_SITE_URL` = your Vercel production URL (for Open Graph / metadata), e.g. `https://sports-tv-lovat.vercel.app`.

3. **CORS (required for “live” data)**  
   On Render, set `CORS_ORIGINS` to a **comma-separated** list of allowed origins, **no trailing slashes**, e.g.:

   `http://localhost:3000,https://sports-tv-lovat.vercel.app`

   After changing CORS or API URL, redeploy backend and clear the browser cache if needed.

4. **First content**  
   Log in to **Admin** → run **Sync IPTV M3U** so channels appear on the home page.

Full Bengali step-by-step: **[DEPLOYMENT_GUIDE_BN.md](./DEPLOYMENT_GUIDE_BN.md)**.

---

## PWA

- Production builds register a service worker via `@ducanh2912/next-pwa` (disabled in `development`).  
- Icons live under `frontend/public/icons/`.  
- Install: browser menu → *Install app* / *Add to Home Screen*.

---

## Security

- Use a **strong** `JWT_SECRET_KEY` and **unique** admin password in production.  
- Restrict `CORS_ORIGINS` to your real frontend origins only.  
- **If any database URL, JWT secret, or admin password was shared in chat, tickets, or screenshots, rotate them immediately** (Neon: reset password; generate new JWT secret; update Render env; redeploy).

---

## Credits

- **Development & architecture:** [Mumain Ahmed — AI Solution Architect](https://mumainsumon.netlify.app/)  
- Portfolio, contact, and enterprise stack details: [mumainsumon.netlify.app](https://mumainsumon.netlify.app/)

---

## Repository layout

```
backend/     FastAPI app (uvicorn app.main:app)
frontend/    Next.js app (npm run build)
render.yaml  Optional Render Blueprint for the API
```

## License

Private / use per your team policy. Third-party streams are provided by external sources; compliance with local law and rightsholders is your responsibility.
