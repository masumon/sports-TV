# Global Sports Live TV – ডিপ্লয়মেন্ট গাইড (বাংলা)

এই গাইডে আপনি পুরো মনোরেপো প্রোজেক্ট (FastAPI backend + Next.js frontend) লোকালি রান করা, `.env` কনফিগার করা, `iptv_scraper.py` কীভাবে কাজ করে, এবং GitHub থেকে **Vercel (Frontend)** ও **Render (Backend)** এ ডিপ্লয় করার সম্পূর্ণ ধাপ পাবেন।

---

## ১) প্রজেক্ট স্ট্রাকচার

এই রিপোজিটরির কাঠামো:

- `backend/` → FastAPI API সার্ভার
- `frontend/` → Next.js App Router UI
- `.gitignore` → Python + Node উভয়ের জন্য
- `DEPLOYMENT_GUIDE_BN.md` → এই ডকুমেন্ট

Backend মূল অংশ:

- `backend/app/api/routes/` → `auth.py`, `sports_tv.py`, `live_scores.py`, `admin.py`
- `backend/app/core/` → `config.py`, `security.py`
- `backend/app/models/` → `channel.py`, `match_stats.py`, `user.py`
- `backend/app/services/iptv_scraper.py`
- `backend/app/db/session.py`

Frontend মূল অংশ:

- `frontend/src/app/` → `(viewer)/` হোম, `admin/`, `offline/`, `manifest`
- `frontend/src/components/` → `home/`, `layout/`, `PremiumPlayer`, `AuthSessionSync`, ইত্যাদি
- `frontend/src/store/` → `authStore`, `subscriptionStore`, `uiStore`, `playerStore`
- `frontend/src/lib/` → `apiClient.ts`, `types.ts`, `i18n/`

**নতুন env (বিস্তারিত `README.md` ও `.env.example` দেখুন):** `REDIS_URL`, `CACHE_TTL_SECONDS`, `SCHEDULED_SYNC_INTERVAL_MINUTES`, `SYNC_RATE_LIMIT_SECONDS`।

---

## ২) লোকাল রান করার প্রয়োজনীয়তা

আপনার মেশিনে থাকা উচিত:

1. **Python 3.11+**
2. **Node.js 20+** (বা LTS)
3. **npm**
4. (ঐচ্ছিক) **PostgreSQL** – প্রোডাকশন-সদৃশ টেস্টের জন্য

---

## ৩) Backend লোকালি রান (FastAPI)

### ধাপ ৩.১: Backend dependencies install

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### ধাপ ৩.২: `.env` সেটআপ

`backend/.env.example` থেকে `.env` বানান:

```bash
cp .env.example .env
```

`backend/.env` উদাহরণ:

```env
APP_NAME=Global Sports Live TV API
APP_ENV=development
DEBUG=true
API_V1_PREFIX=/api/v1
APP_HOST=0.0.0.0
APP_PORT=8000

# PostgreSQL ব্যবহার করলে DATABASE_URL দিন, না দিলে SQLite fallback ব্যবহার হবে
DATABASE_URL=
SQLITE_FALLBACK_URL=sqlite:///./sports_tv.db

JWT_SECRET_KEY=your-strong-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

ADMIN_EMAIL=admin@gstv.local
ADMIN_PASSWORD=Admin12345!
ADMIN_FULL_NAME=Platform Admin

CORS_ORIGINS=http://localhost:3000
SCRAPER_SOURCE_URL=https://iptv-org.github.io/iptv/categories/sports.m3u
AUTO_SYNC_CHANNELS_ON_STARTUP=false
```

### ধাপ ৩.৩: API সার্ভার চালু

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

যাচাই:

- Health: `http://localhost:8000/health`
- OpenAPI docs: `http://localhost:8000/docs`

---

## ৪) Frontend লোকালি রান (Next.js)

### ধাপ ৪.১: dependencies install

```bash
cd frontend
npm install
```

### ধাপ ৪.২: `.env.local` সেটআপ

```bash
cp .env.local.example .env.local
```

`frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

> নোট: `apiClient.ts` নিজে `/api/v1/...` path যোগ করে।

### ধাপ ৪.৩: dev server চালু

```bash
npm run dev
```

তারপর:

- Public UI: `http://localhost:3000`
- Admin Login: `http://localhost:3000/admin/login`
- Admin Dashboard: `http://localhost:3000/admin/dashboard`

---

## ৫) `iptv_scraper.py` কীভাবে কাজ করে

ফাইল: `backend/app/services/iptv_scraper.py`

### কাজের ফ্লো

1. `fetch_sports_m3u()`  
   - `requests.get(...)` দিয়ে URL থেকে M3U ফাইল আনে:
     - `https://iptv-org.github.io/iptv/categories/sports.m3u`
   - Response valid কিনা যাচাই করে (`#EXTM3U` header)।

2. `parse_m3u_entries()`  
   - M3U এর `#EXTINF` লাইন থেকে metadata parse করে:
     - Channel name
     - stream URL
     - `tvg-logo`
     - `group-title`
     - `tvg-country`
     - `tvg-language`

3. `sync_channels_from_entries()`  
   - DB-তে `stream_url` unique key ধরে upsert করে:
     - নতুন হলে create
     - পুরোনো হলে update
   - `source="iptv-org"` ও `is_active=True` সেট করে।

4. `scrape_and_sync_sports_channels()`  
   - উপরের ৩টি ধাপ একসাথে রান করে
   - return দেয় `{created, updated, total}`।

### API ট্রিগার

Admin JWT token সহ:

`POST /api/v1/admin/channels/sync`

এন্ডপয়েন্ট থেকেই scraper রান হয়।

---

## ৬) SQLite vs PostgreSQL কনফিগারেশন

### Local দ্রুত রান (SQLite fallback)

`.env` এ:

```env
DATABASE_URL=
SQLITE_FALLBACK_URL=sqlite:///./sports_tv.db
```

### Production (PostgreSQL)

`.env` এ:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME
```

`DATABASE_URL` থাকলে সেটাই ব্যবহার হবে, না থাকলে SQLite fallback।

---

## ৭) GitHub প্রস্তুতি

1. কোড commit/push করুন।
2. GitHub repository public/private যেটাই হোক, Vercel ও Render উভয়কেই repo access দিন।
3. Backend ও Frontend একই monorepo থেকে আলাদা সার্ভিস হিসেবে deploy হবে।

---

## ৮) Frontend Vercel এ ডিপ্লয় (GitHub থেকে)

### ধাপসমূহ

1. Vercel Dashboard → **Add New Project**
2. আপনার GitHub repo import করুন
3. **Root Directory** দিন: `frontend`
4. Framework auto-detect হবে: **Next.js**
5. Environment Variable যুক্ত করুন:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://<your-render-backend-domain>` (ট্রেইলিং স্ল্যাশ ছাড়া, `/api/v1` সফিক্স ছাড়া)
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-vercel-domain>` (Open Graph / SEO; উদাহরণ: `https://sports-tv-lovat.vercel.app`)
6. Deploy দিন

### গুরুত্বপূর্ণ

- Backend URL এ `/api/v1` যোগ করবেন না; client কোড নিজেই path যোগ করে।
- ডোমেইন বদলালে Vercel env update করে redeploy দিন।
- **লাইভ ডেটার জন্য** Render ব্যাকএন্ডের `CORS_ORIGINS` এ Vercel URL অবশ্যই থাকতে হবে (কমা দিয়ে একাধিক):  
  `http://localhost:3000,https://sports-tv-lovat.vercel.app`

---

## ৯) Backend Render এ ডিপ্লয় (GitHub থেকে)

### ধাপ ৯.১: PostgreSQL তৈরি

Render এ নতুন PostgreSQL instance তৈরি করুন, connection string নোট করুন।

### ধাপ ৯.২: Web Service তৈরি

1. Render Dashboard → **New +** → **Web Service**
2. GitHub repo select করুন
3. সেটিংস:
   - **Root Directory**: `backend`
   - **Runtime**: Python
   - **Build Command**:  
     `pip install -r requirements.txt`
   - **Start Command**:  
     `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### ধাপ ৯.৩: Environment Variables

Render service env-এ দিন:

- `APP_ENV=production`
- `DEBUG=false`
- `API_V1_PREFIX=/api/v1`
- `DATABASE_URL=<render-postgres-connection-string>`
- `SQLITE_FALLBACK_URL=sqlite:///./sports_tv.db`
- `JWT_SECRET_KEY=<strong-random-secret>`
- `JWT_ALGORITHM=HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES=1440`
- `ADMIN_EMAIL=admin@yourdomain.com`
- `ADMIN_PASSWORD=<strong-password>`
- `ADMIN_FULL_NAME=Platform Admin`
- `CORS_ORIGINS=http://localhost:3000,https://<your-vercel-domain>` (প্রোডে শুধু নিজের ফ্রন্টএন্ড ডোমেইন রাখুন; ট্রেইলিং `/` নয়)
- `SCRAPER_SOURCE_URL=https://iptv-org.github.io/iptv/categories/sports.m3u`
- `AUTO_SYNC_CHANNELS_ON_STARTUP=false`

### ধাপ ৯.৪: Deploy verify

- `https://<render-domain>/health` → `{"status":"ok"}`
- `https://<render-domain>/docs` → Swagger UI

---

## ১০) পূর্ণ সিস্টেম কানেকশন টেস্ট

1. Render backend live কিনা দেখুন (`/health`)
2. Vercel frontend env-এ backend base URL সঠিক কিনা দেখুন
3. Admin login করুন (Render env-এ দেয়া admin credential)
4. Dashboard থেকে:
   - `Sync IPTV M3U` চাপুন
   - Channel list populate হচ্ছে কিনা দেখুন
   - নতুন score add করে homepage overlay-তে আসছে কিনা দেখুন

---

## ১১) নিরাপত্তা ও প্রোডাকশন সুপারিশ

1. `JWT_SECRET_KEY` খুব শক্তিশালী রাখুন — কখনো GitHub বা চ্যাটে শেয়ার করবেন না।
2. `ADMIN_PASSWORD` প্রোডাকশনে অনন্য ও শক্ত রাখুন।
3. **ডাটাবেস URL বা পাসওয়ার্ড লিক হলে** (চ্যাট, স্ক্রিনশট, লগ) — Neon/PostgreSQL এ পাসওয়ার্ড রিসেট, `DATABASE_URL` আপডেট, Render redeploy।
4. `CORS_ORIGINS` শুধুমাত্র trusted frontend origin রাখুন (কমা সেপারেটেড)।
5. সম্ভব হলে HTTPS-only ও reverse proxy hardening যুক্ত করুন।
6. ভবিষ্যতে DB migrations (Alembic) যোগ করা ভালো।

রিপোতে ইংরেজি ওভারভিউ: **[README.md](./README.md)**।

---

## ১২) সাধারণ সমস্যা ও সমাধান

### সমস্যা: Frontend থেকে API call fail
- `NEXT_PUBLIC_API_BASE_URL` ভুল আছে কিনা দেখুন।
- Backend domain alive কিনা `curl <domain>/health` দিয়ে চেক করুন।

### সমস্যা: CORS error
- Backend env-এ `CORS_ORIGINS` এ Vercel domain যুক্ত করুন।

### সমস্যা: স্ক্র্যাপার sync কাজ করছে না
- `SCRAPER_SOURCE_URL` accessible কিনা দেখুন।
- Render logs-এ network timeout বা parsing error দেখুন।

### সমস্যা: Admin login কাজ করছে না
- Render env-এর `ADMIN_EMAIL`, `ADMIN_PASSWORD` যাচাই করুন।
- প্রথম startup-এ seed user তৈরি হয়েছে কিনা DB-তে দেখুন।

---

## ১৩) লোকাল ডেভেলপমেন্ট শর্ট কমান্ড

Backend:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm run dev
```

---

## ১৪) PWA (প্রগ্রেসিভ ওয়েব অ্যাপ)

- প্রোডাকশন বিল্ডে সার্ভিস ওয়ার্কার রেজিস্টার হয় (`@ducanh2912/next-pwa`)। লোকাল `npm run dev` এ PWA সাধারণত বন্ধ থাকে।
- আইকন: `frontend/public/icons/` (SVG)। প্রয়োজনে PNG ১৯২/৫১২ যোগ করতে পারেন।
- ব্রাউজার মেনু থেকে **Install app** / **Add to Home Screen** দিয়ে ইনস্টল করুন।

## ১৫) ডেভেলপার ক্রেডিট

- **আর্কিটেকচার ও ডেভেলপমেন্ট:** [Mumain Ahmed — AI Solution Architect](https://mumainsumon.netlify.app/)
- পোর্টফোলিও, যোগাযোগ ও টেক স্ট্যাক: [mumainsumon.netlify.app](https://mumainsumon.netlify.app/)

---

আপনার প্ল্যাটফর্ম এখন production-ready foundation সহ চলার জন্য প্রস্তুত: secure JWT admin, IPTV auto-sync, premium HLS player UI, PWA, এবং real-time live score overlay সহ end-to-end monorepo architecture।
