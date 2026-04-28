# Environment variables — রেডি-টু-ইউজ (কোডবেস পূর্ণ পর্যবেক্ষণ)

সূত্র: `backend/app/core/config.py` (Pydantic `Settings` + `os.getenv`), `backend/app/main.py` (`INTERNAL_SYNC_SECRET`), `backend/app/core/redis_client.py` (`REDIS_URL`), `frontend/next.config.ts`, `frontend/src/lib/apiClient.ts`, `frontend/src/app/layout.tsx`।

- **ব্যাকএন্ড** এনভ কী-গুলো **টাইপ/ডিফল্ট** = `config.py` ফিল্ড নাম; রানটাইমে `UPPER_SNAKE_CASE` (`case_sensitive=False`)।
- **প্রোড** (`APP_ENV=production`) এ `.env` ফাইল **লোড হয় না** — Render/Vercel ড্যাশবোর্ড/CLI থেকেই সেট করতে হবে।
- **সিক্রেট** কখনো রিপোতে কমিট করবেন না; নিচে প্লেসহোল্ডার দিয়ে কপি করুন।

---

## ১) Render (FastAPI) — সব `Settings` কী (আক্ষরিক নাম = কপি-পেস্ট)

| Environment key | কোডে ডিফল্ট | প্রোডে বাধ্য? | সংক্ষিপ্ত ব্যাখ্যা |
|-------------------|-------------|----------------|---------------------|
| `APP_NAME` | `Global Sports Live TV API` | না | API টাইটেল |
| `APP_ENV` | `development` | **হ্যাঁ** = `production` | প্রোডে SQLite / খালি JWT ব্লক |
| `DEBUG` | `true` | **হ্যাঁ** = `false` | এরর বডি, লগ লেভেল |
| `API_V1_PREFIX` | `/api/v1` | সুপারিশ: `/api/v1` | সব আউট `.../api/v1/...` |
| `APP_HOST` | `0.0.0.0` | ঐচ্ছিক | Render সাধারণত আবশ্য না |
| `APP_PORT` | `8000` | ঐচ্ছিক | Render `$PORT` দেয়; uvicorn `PORT` |
| `DATABASE_URL` | `None` (তখন SQLite) | **প্রোডে হ্যাঁ** | Neon/Postgres; `config` অটো `postgresql+psycopg` + `channel_binding=disable` |
| `SQLITE_FALLBACK_URL` | `sqlite:///./sports_tv.db` | প্রোডে ব্যবহার না | লোকাল/ডেভ |
| `JWT_SECRET_KEY` | `replace-with-strong-secret` | **প্রোডে হ্যাঁ** | `openssl rand -hex 32` — সহজ-অনুমান স্ট্রিং ব্লক |
| `JWT_ALGORITHM` | `HS256` | সুপারিশ: `HS256` | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | ঐচ্ছিক | |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | `60` | ঐচ্ছিক | |
| `PASSWORD_RESET_RATE_LIMIT_SECONDS` | `120` | ঐচ্ছিক | |
| `ADMIN_EMAIL` | `admin@test.com` | সুপারিশ | সিড-অ্যাডমিন |
| `ADMIN_PASSWORD` | `Admin12345!` | **প্রোডে শক্ত** | `ensure_admin_seed` |
| `ADMIN_FULL_NAME` | `Platform Admin` | ঐচ্ছিক | |
| `CORS_ORIGINS` | `http://localhost:3000` | ঐচ্ছিক* | Comma; ট্রেইলিং `/` `config` ছাঁটে; `main.py` এ `https://*.vercel.app` রেজেক্সও আছে |
| `SCRAPER_SOURCE_URL` | `https://iptv-org.github.io/iptv/categories/sports.m3u` | ঐচ্ছিক | প্রধান M3U সিড |
| `AUTO_SYNC_CHANNELS_ON_STARTUP` | `false` | ঐচ্ছিক | খালি DB তে `main.py` একবার সিঙ্ক দেয় |
| `REDIS_URL` | `None` | ঐচ্ছিক | `redis://` বা `rediss://` (Redis Cloud) |
| `CACHE_TTL_SECONDS` | `300` | ঐচ্ছিক | চ্যানেল তালিকা ক্যাশ |
| `SYNC_RATE_LIMIT_SECONDS` | `60` | ঐচ্ছিক | অ্যাডমিন `POST /admin/channels/sync` |
| `SCHEDULED_SYNC_INTERVAL_MINUTES` | `0` | ঐচ্ছিক | কোড ডিফল্ট `0` (ফ্রি টিয়ার সুপারিশ); `>0` হলে প্রতি N মিনিটে DB M3U সিঙ্ক |
| `SOURCE_DISCOVERY_INTERVAL_HOURS` | `0` | ঐচ্ছিক | ফ্রি টিয়ারে `0` রাখুন |
| `CHANNEL_STALE_DAYS` | `3` | ঐচ্ছিক | স্টেইল চ্যানেল ডিঅ্যাকটিভ |
| `DB_POOL_SIZE` | `5` | ঐচ্ছিক | Neon free: `3` সুপারিশ (`render.yaml`) |
| `DB_MAX_OVERFLOW` | `10` | ঐচ্ছিক | Neon free: `5` সুপারিশ |
| `M3U8_REFRESH_INTERVAL_MINUTES` | `0` | ঐচ্ছিক | Playwright; ফ্রি টিয়ারে `0` |
| `STREAM_VALIDATION_INTERVAL_MINUTES` | `0` | ঐচ্ছিক | `0` = নির্ধারিত স্ট্রিম চেক বন্ধ |

**`Settings` বাইরে (শুধু নির্দিষ্ট ফাইল):**

| Environment key | বাধ্য? | ব্যাখ্যা |
|-----------------|--------|----------|
| `INTERNAL_SYNC_SECRET` | ক্রন বা ওয়েবহুক দিয়ে `POST /internal/sync` চালালে | প্রোডে **খালি** থাকলে সেই এন্ডপয়েন্ট **503**; সেট হলে `X-Sync-Secret` হেডার একই |
| `REDIS_URL` | ঐচ্ছিক | `redis_client` সর্বপ্রথম `os.environ` পড়ে, তারপর `settings.redis_url` |

---

## ২) Vercel (Next.js) — কোডে যা পড়া হয়

| Environment key | ফাইল | ডিফল্ট / মন্তব্য |
|-------------------|--------|------------------|
| `NEXT_PUBLIC_API_BASE_URL` | `apiClient.ts` | বাদ দিলে **`/api`** — ব্রাউজার same-origin, path `/api/v1/...` |
| `BACKEND_URL` | `next.config.ts` rewrites | প্রোড: বাদ দিলে **`https://gstv-backend.onrender.com`** — **অন্য Render সেবা হলে অবশ্যই সেট** করুন; শেষে `/` বা `/api` **না** |
| `NEXT_PUBLIC_SITE_URL` | `layout.tsx` metadata / OG | বাদ দিলে Vercel `VERCEL_URL` বা স্ট্যাটিক ফলব্যাক; প্রোডে নিজের URL দিন |
| `NODE_ENV` | `next.config` PWA | বিল্ডে স্বয়ং; ম্যানুয়ালি ঠিক করবেন না |
| `VERCEL_URL` | `layout.tsx` | Vercel স্বয়ং; সেট করবেন না |
| `VERCEL_ENV` | `layout.tsx` (preview) | Vercel স্বয়ং |

**সতর্কতা:** `NEXT_PUBLIC_*` ব্রাউজারে প্রকাশ — সিক্রেট কখনো `NEXT_PUBLIC_` prefix দেবেন না।

---

## ৩) কপি-পেস্ট — Render (মান `<<<...>>>` বদলান)

`<<<JWT_SECRET>>>` = টার্মিনালে: `openssl rand -hex 32` (আলাদা দুবার, JWT ও Internal আলাদা)।

```env
APP_ENV=production
DEBUG=false
API_V1_PREFIX=/api/v1
APP_NAME=Global Sports Live TV API
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
JWT_SECRET_KEY=<<<PASTE_openssl_rand_hex_32_1>>>
DATABASE_URL=<<<PASTE_NEON_OR_POSTGRES_POOLER_URL>>>
CORS_ORIGINS=https://YOUR-VERCEL-APP.vercel.app,http://localhost:3000
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<<<STRONG_ADMIN_PASSWORD>>>
ADMIN_FULL_NAME=Platform Admin
SCRAPER_SOURCE_URL=https://iptv-org.github.io/iptv/categories/sports.m3u
AUTO_SYNC_CHANNELS_ON_STARTUP=false
SYNC_RATE_LIMIT_SECONDS=60
SCHEDULED_SYNC_INTERVAL_MINUTES=0
CACHE_TTL_SECONDS=300
DB_POOL_SIZE=3
DB_MAX_OVERFLOW=5
PASSWORD_RESET_TOKEN_TTL_MINUTES=60
PASSWORD_RESET_RATE_LIMIT_SECONDS=120
SOURCE_DISCOVERY_INTERVAL_HOURS=0
CHANNEL_STALE_DAYS=3
M3U8_REFRESH_INTERVAL_MINUTES=0
STREAM_VALIDATION_INTERVAL_MINUTES=0
REDIS_URL=
INTERNAL_SYNC_SECRET=<<<PASTE_openssl_rand_hex_32_2_OR_leave_empty_if_no_cron_hits_internal_sync>>>
```

- `REDIS_URL` অপ্রয়োজনে ভেরিয়েবলই বাদ দিন যদি Dash খালি সেভ না করে।
- `INTERNAL_SYNC_SECRET` খালি রাখলে প্রোডে শুধু `POST /internal/sync` 503; বাকি API রাউট ঠিক চলবে।

---

## ৪) কপি-পেস্ট — Vercel (ফ্রন্ট)

```env
NEXT_PUBLIC_API_BASE_URL=/api
BACKEND_URL=https://YOUR-RENDER-SERVICE.onrender.com
NEXT_PUBLIC_SITE_URL=https://YOUR-VERCEL-APP.vercel.app
```

- `BACKEND_URL` = আপনি Render-এ **Deploy** দেখা সেই হোস্ট (অন্য নামে সেবা হলে `gstv-backend` নয়)।

---

## ৫) কপি-পেস্ট — লোকাল `backend/.env` (ডেভ; প্রোডের মতো `APP_ENV=production` এখানে **ব্যবহার করবেন না** যদি না জেনে টেস্ট করেন)

`backend/.env.example` থেকেও মিলায়া নিন।

```env
APP_ENV=development
DEBUG=true
API_V1_PREFIX=/api/v1
JWT_SECRET_KEY=dev-only-not-for-production
DATABASE_URL=
# অথবা Neon লোকাল টেস্ট: postgresql+psycopg://...
CORS_ORIGINS=http://localhost:3000
SCRAPER_SOURCE_URL=https://iptv-org.github.io/iptv/categories/sports.m3u
SCHEDULED_SYNC_INTERVAL_MINUTES=0
```

---

## ৬) কপি-পেস্ট — লোকাল `frontend/.env.local`

```env
NEXT_PUBLIC_API_BASE_URL=/api
NEXT_PUBLIC_SITE_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000
```

Next ডেভ সার্ভার rewrites: `/api` → `BACKEND_URL`।

---

## ৭) যাচাইকরণ (সংক্ষেপ)

- Render: `GET /health` → `status: ok`; `GET /health/db` → `db: ok`।
- Vercel: ব্রাউজার `Network` বা `curl` দিয়ে `https://<vercel>/api/v1/health` = আপনার Render-এর রেসপন্স (তাহলে `BACKEND_URL` ঠিক)।

---

*এই ফাইল জেনারেট: রিপো `config.py` + উপরে উল্লিখিত সোর্স মিলিয়ে। সিক্রেট/DB URL সতর্কতা: চ্যাটে আসল মান শেয়ার করবেন না।*
