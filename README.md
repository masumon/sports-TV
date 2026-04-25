# ABO Sports TV Live

Next.js + FastAPI platform for live sports and Bangladesh TV channel discovery, HLS playback, admin channel management, live scores, optional IPTV sync, and PWA offline support.

## Architecture

- `frontend/`: Next.js 15, React 19, TypeScript, Tailwind, Zustand, HLS.js, PWA.
- `backend/`: FastAPI, SQLAlchemy, SQLite for local development, optional PostgreSQL/Redis/Playwright automation.
- `render.yaml`: Render backend service configuration.
- `frontend/vercel.json`: Vercel frontend configuration.

## Local setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Useful checks:

```bash
curl http://localhost:8000/health
curl "http://localhost:8000/api/v1/sports-tv/channels?page=1&page_size=5"
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

For local integration, keep:

```env
NEXT_PUBLIC_API_BASE_URL=/api
BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Open `http://localhost:3000`.

## Admin login

The backend seeds one admin account on first startup from environment variables:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_FULL_NAME`

Local defaults are documented in `backend/.env.example`: **admin@test.com** / **Admin12345!** (set the same `ADMIN_EMAIL` / `ADMIN_PASSWORD` on Render; Vercel does not store these).

## Validation checklist

- Backend health: `GET /health`
- Backend DB: `GET /health/db`
- Public channels: `GET /api/v1/sports-tv/channels`
- Live scores: `GET /api/v1/live-scores`
- Frontend viewer: channel list, filters, player, backup links
- Admin: login, dashboard stats, channel create/delete, score create/update/delete
- Build: `npm run build`

## Project analysis and fixes in this branch

- Local frontend rewrites now default to `http://localhost:8000` instead of production when `BACKEND_URL` is unset.
- Player proxy URLs now use the same API base builder as the rest of the frontend.
- Backend `/health/db` no longer returns masked password suffixes or URL fragments.
- Admin channel creation now preserves the selected module and validates form data before submitting.
- Viewer empty/error states are clearer and provide retry/reset actions.
- README now documents setup, run commands, validation, and project analysis.

