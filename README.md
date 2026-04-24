# Global Sports Live TV

**IPTV-style sports streaming platform** — monorepo with a **FastAPI** API (async SQLAlchemy, PostgreSQL/SQLite, optional Redis cache, JWT admin, M3U sync) and a **Next.js 15** viewer + admin UI (HLS.js, PWA, i18n EN/BN, Zustand).

---

## Highlights

| Area | Details |
|------|---------|
| **Viewer** | Netflix-style shell, channel grid, live score overlay, HLS player (VLC / MX / new tab) |
| **API** | `GET /api/v1/sports-tv/channels`, `GET /api/v1/live-scores`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, admin CRUD + M3U sync |
| **Auth** | `Authorization: Bearer <token>`; `401` clears client session when a token was sent |
| **Deploy** | Frontend → **Vercel** (`frontend/`). Backend → **Render** (or any host) with `backend/` root. **CORS** must list your Vercel URL. |
| **Data** | Channels from iptv-org sports M3U (configurable URL); optional **Redis** for response cache |

> **Compliance:** Third-party streams are external; you are responsible for rights and local law.

---

## Repository layout

```
sports-TV/
├── backend/          # FastAPI — uvicorn app.main:app
├── frontend/         # Next.js 15 — App Router, PWA
├── render.yaml       # Optional Render Blueprint (API)
├── README.md
└── DEPLOYMENT_GUIDE_BN.md   # বাংলায় ধাপে ধাপে ডিপ্লয়
```

---

## Requirements

- **Node.js** 20+ (LTS recommended)  
- **Python** 3.11+  
- **PostgreSQL** (production) or SQLite (local default)  
- **Redis** (optional, for API response caching)

---

## Local development

### 1) Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — at minimum JWT_SECRET_KEY, CORS_ORIGINS, and admin credentials
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health: [http://localhost:8000/health](http://localhost:8000/health)  
- OpenAPI: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2) Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm run dev
```

- App: [http://localhost:3000](http://localhost:3000)  
- Admin: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

### 3) First content

1. Log in to **Admin** (credentials from `backend/.env`).  
2. Run **Sync IPTV M3U** (or set `SCHEDULED_SYNC_INTERVAL_MINUTES` on the server).  
3. Open the home page — channels should list (300+ after a successful sync, depending on source).

---

## Environment variables (summary)

| Location | Variable | Purpose |
|----------|----------|---------|
| **Backend** | `DATABASE_URL` | PostgreSQL (prod). Empty → SQLite file | 
| | `JWT_SECRET_KEY` | **Required in production** — long random string | 
| | `CORS_ORIGINS` | Comma-separated origins, **no** trailing slash (local + Vercel) | 
| | `REDIS_URL` | Optional; enables shared cache for lists | 
| | `SCHEDULED_SYNC_INTERVAL_MINUTES` | `0` = off; e.g. `30` for periodic M3U sync | 
| **Frontend** | `NEXT_PUBLIC_API_BASE_URL` | API origin only (e.g. `https://api.example.com`) — app appends `/api/v1/...` | 
| | `NEXT_PUBLIC_SITE_URL` | Public site URL for metadata / OG | 

Full lists: [`backend/.env.example`](./backend/.env.example), [`frontend/.env.local.example`](./frontend/.env.local.example).

**Never commit** real `.env` / `.env.local` or database passwords. Rotate any credential that was ever shared publicly.

---

## Production: Vercel + Render (typical)

### Render (API)

1. New **Web Service** — connect repo, **Root Directory:** `backend`.  
2. **Build:** `pip install -r requirements.txt`  
3. **Start:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`  
4. **Health check path:** `/health`  
5. Set environment variables in the dashboard (see `render.yaml` for a starter list; use `sync: false` for secrets).  
6. `APP_ENV=production` and a **strong** `JWT_SECRET_KEY` are required.

### Vercel (frontend)

1. Import repo, **Root Directory:** `frontend`.  
2. **Environment variables** (Production + Preview as needed):  
   - `NEXT_PUBLIC_API_BASE_URL` = your Render service URL, **no** trailing slash, **no** `/api/v1` suffix.  
   - `NEXT_PUBLIC_SITE_URL` = your Vercel production URL.  
3. Redeploy after any API or CORS change.

### CORS (critical)

On Render, set `CORS_ORIGINS` to include every frontend origin, e.g.:

`http://localhost:3000,https://your-app.vercel.app`

No trailing slashes. Redeploy the API after changes.

**বিস্তারিত বাংলা নির্দেশনা:** [DEPLOYMENT_GUIDE_BN.md](./DEPLOYMENT_GUIDE_BN.md)

---

## PWA

- Production uses `@ducanh2912/next-pwa` (service worker disabled in `development`).  
- Icons: `frontend/public/icons/`.  
- Offline fallback: `/offline`.  
- Generated `sw.js` / `workbox-*.js` are gitignored (rebuilt on deploy).

---

## Scripts

| Command | Where | Purpose |
|---------|--------|---------|
| `uvicorn app.main:app --reload` | `backend` | API dev server |
| `npm run dev` | `frontend` | Next dev |
| `npm run build` / `npm start` | `frontend` | Production build / start |

---

## Security checklist

- [ ] `JWT_SECRET_KEY` unique and long (e.g. `openssl rand -hex 32`)  
- [ ] `ADMIN_PASSWORD` changed from any sample value  
- [ ] `CORS_ORIGINS` restricted to your frontends only  
- [ ] HTTPS in production; no secrets in client bundles (only `NEXT_PUBLIC_*` is public)  

---

## Credits

- **Lead / architecture:** [Mumain Ahmed](https://mumainsumon.netlify.app/)

---

## License

Private / per your team policy. Third-party stream sources are not controlled by this repository.
