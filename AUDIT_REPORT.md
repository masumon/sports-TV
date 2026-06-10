# 🩺 Surgical Audit Report — sports-TV

**তারিখ:** ২০২৬-০৬-০৯
**পরিধি:** পুরো monorepo (backend FastAPI + frontend Next.js 15 + ops configs)
**পদ্ধতি:** স্ট্যাটিক কোড রিভিউ, কনফিগারেশন বিশ্লেষণ, সিকিউরিটি প্যাটার্ন অডিট, ডিপেন্ডেন্সি চেক, ডিপ্লয়মেন্ট স্ক্রিপ্ট পর্যালোচনা
**গ্রেডিং:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low / Good

---

## ১. এক্সিকিউটিভ সামারি

| ক্ষেত্র | স্কোর | মন্তব্য |
|---|---|---|
| **সিকিউরিটি** | 7 / 10 | JWT, CORS, SSRF, টাইমিং অ্যাটাক, সিড-অ্যাডমিন গার্ড — সব ঠিক আছে; কিছু hardening দরকার |
| **ব্যাকএন্ড আর্কিটেকচার** | 8 / 10 | Sync/async ইঞ্জিন ভালোভাবে আলাদা; schema migration defensive |
| **ফ্রন্টএন্ড আর্কিটেকচার** | 8 / 10 | PWA, store hygiene, CSP ভালো; কিছু dead-code পরিষ্কার করা যায় |
| **ডিপ্লয়মেন্ট / Ops** | 8.5 / 10 | Render + Vercel free-tier fit-for-purpose; cold start ও RAM বিবেচনায় নেওয়া |
| **ডিপেন্ডেন্সি** | 7 / 10 | Pinned majors; `playwright` + `bcrypt` সীমাবদ্ধতা সচেতনভাবে |
| **Documentation** | 9 / 10 | DEPLOYMENT.md, OPS_BN.md, ENV_COPY_PASTE.md চমৎকার |

**Overall verdict:** ✅ প্রোডাকশন-রেডি **hardening-এর পর**। নিচের Critical/High আইটেমগুলো ১ সপ্তাহের মধ্যে ঠিক করুন।

---

## ২. আর্কিটেকচারাল ওভারভিউ

```
┌──────────────┐  rewrite   ┌──────────────────────┐
│  Vercel      │ ─────────► │  Render (FastAPI)    │
│  Next.js 15  │            │  • /api/v1/...        │
│  PWA + CSP   │            │  • /proxy/stream      │
│  Zustand     │            │  • /proxy/playlist    │
│  HLS.js/DASH │            │  • /proxy/m3u8        │
└──────┬───────┘            └──────┬───────────────┘
       │                            │ asyncpg + NullPool
       │                            ▼
       │                       ┌──────────┐
       │                       │ Neon PG  │  (channel_binding=disable)
       │                       └──────────┘
       │                            │
       │                            ▼
       │              ┌────────────────────────┐
       │              │ Redis (optional)       │
       │              │ • list cache           │
       │              │ • M3U dedup            │
       │              │ • sync distributed lock│
       │              └────────────────────────┘
       │
       └──► APScheduler (sync 120m / fixtures 60m / validation 120m)
```

**ভালো দিকগুলো:**
- `BackgroundScheduler` (sync thread) + async routes → `run_in_threadpool` দিয়ে আলাদা — event loop ব্লক হয় না।
- `NullPool` + asyncpg + `channel_binding=disable` — Neon pooler compat নিশ্চিত।
- Redis-অপশনাল: নেই থাকলে in-memory LRU + thread-safe ব্যাকফল → single-instance-এও ঠিক চলে।
- HLS.js + DASH.js + native HLS (Safari) — সব ব্রাউজার কভার।
- Manifest rewriter `m3u8` package + regex fallback — নন-HLS playlist ভাঙে না।

---

## ৩. সিকিউরিটি অডিট

### 3.1 ✅ যা ঠিক আছে

| কন্ট্রোল | প্রমাণ |
|---|---|
| **SSRF guard** (proxy) | `_validate_stream_url` host resolve → private/loopback/link-local/multicast/reserved ব্লক (`proxy.py:399-411, 452-496`) |
| **Default JWT secret ব্লক** | `_reject_default_jwt_in_prod` model_validator + startup failure (`config.py:200-205`, `main.py:104-114`) |
| **Default admin email/password ব্লক** | Production-এ `admin@test.com` / `Admin12345!` পেলে RuntimeError (`main.py:110-119`) |
| **Timing-attack safe login** | `_DUMMY_BCRYPT_HASH` দিয়ে সবসময় `verify_password` কল (`auth.py:37-92`) |
| **JWT secret length 72 bytes issue** | `_truncate_for_bcrypt` (security.py:20-25) |
| **CORS** | `allow_origin_regex` Vercel preview-এর জন্য, allow-list env থেকে |
| **CSP** | `next.config.ts:147-176` — `frame-ancestors 'none'`, X-Content-Type-Options, Permissions-Policy |
| **HTTP Bearer scheme** | `HTTPBearer(auto_error=False)` + clear 401/403 messages |
| **Password reset** | SHA-256 hashed token in DB, TTL 60m, rate limit 120s (`auth.py:112-172`) |
| **Register race** | `IntegrityError` caught → 409 (`auth.py:64-71`) |
| **Internal sync secret** | Constant-time compare (`hmac.compare_digest`) in `/internal/sync` ও `/aggregator/bdix/sync` |
| **PWA** | HLS segments bypass SW (`NetworkOnly`), JSON APIs `NetworkFirst` |
| **Frontend token validation** | `isValidToken()` regex in `authStore.ts:16-21` |

### 3.2 🔴 Critical

**C-1. `bcrypt` pin `<5.0.0` কিন্তু passlib pin নেই — compat warning**
```
passlib[bcrypt]>=1.7.4
bcrypt>=4.0.1,<5.0.0
```
- **সমস্যা:** passlib 1.7.4 bcrypt 4.x-এ `__about__` attribute read করতে গিয়ে warning দেয় (security issue নয়, কিন্তু `crypt()` এ ভবিষ্যতে breaking change আসতে পারে)।
- **ফিক্স:** passlib 1.7.4 ও bcrypt 5.x compatibility চেক করে পিন হালনাগাদ করুন অথবা `pwdlib`/native bcrypt ব্যবহার করুন।

**C-2. `SECRET_KEY`-এর production guard কাজ করে, কিন্তু `AccessTokenExpire` 1440m (24h) — JWT revoke নেই**
- **সমস্যা:** Token compromise হলে 24 ঘণ্টা পর্যন্ত valid। Logout শুধু client-side।
- **প্রভাব:** Stolen JWT 24h চলে।
- **ফিক্স (বিকল্প):**
  1. TTL 60m করুন + refresh token যোগ করুন, অথবা
  2. `token_version` column `users` table-এ যোগ করে `/api/v1/auth/me` এ চেক করুন (logout সবসময় server-side effective)।

### 3.3 🟠 High

**H-1. `proxy/stream` সবসময় same-origin (Vercel rewrite), কিন্তু যদি কেউ সরাসরি Render hit করে, `Access-Control-Allow-Origin: *` + `allow_credentials=True` conflict**
- **অবস্থান:** `main.py:368-369` (`allow_credentials=True`) এবং `proxy.py:204-210` (`Access-Control-Allow-Origin: *`)।
- **সমস্যা:** Browser `credentials=include` সহ `*` origin reject করে; কিন্তু credentials ছাড়া CORS bypass করা যায়।
- **মান:** Mitigated কারণ Render URL env থেকে নেওয়া (`CORS_ORIGINS`) — কিন্তু proxy endpoint নিজে `*` পাঠায়।
- **ফিক্স:** Proxy CORS-এ `Origin` echo করুন allowlist match হলে, অথবা simple requests-এ `*` রাখুন কিন্তু `Access-Control-Allow-Credentials: true` সরান (যেহেতু JWT header-based, cookie দরকার নেই)।

**H-2. `verify=False` সব upstream httpx call-এ (TLS bypass)**
- **অবস্থান:** `proxy.py:272, 511, 814, 1111, 1322`, `stream_validator.py:64, 195`, `stream_probe.py:124`
- **ঝুঁকি:** MITM on Render → upstream. Render egress trusted হলেও production-এ default verify=True ভালো।
- **ফিক্স:** Cert bundle env-এ allow করুন (`STREAM_UPSTREAM_INSECURE=false` দিয়ে opt-in)।
- **Trade-off:** কিছু IPTV CDN self-signed cert ব্যবহার করে — তাই default false রাখা বাস্তবসম্মত, কিন্তু **warning log** ও env-knob রাখুন।

**H-3. `proxy` endpoint-এ `client_ip = request.client.host` — X-Forwarded-For trusted না**
- **অবস্থান:** `proxy.py:897`, `sports_tv.py:194`
- **সমস্যা:** Render/Cloudflare reverse proxy-র পেছনে সবসময় একই IP দেখাবে → rate-limit ineffective।
- **ফিক্স:** `request.headers.get("cf-connecting-ip")` বা `x-forwarded-for` (last hop) ব্যবহার করুন, `settings.trust_proxy_headers=True` env flag-সহ।

**H-4. `render.yaml`-এ `ADMIN_PASSWORD: sync: false` কিন্তু `ADMIN_EMAIL: value: admin@test.com` hard-coded**
- **অবস্থান:** `render.yaml:83-85`
- **ঝুঁকি:** Production-এ default email থাকলে startup fail করবে (RuntimeError) — **ভালো**, কিন্তু misconfig-এ deploy ভাঙবে।
- **ফিক্স:** Render dashboard নির্দেশনায় প্রথম deploy-এ `ADMIN_EMAIL` override করতে বলুন, বা blueprint `value` সরিয়ে `sync: false` রাখুন।

### 3.4 🟡 Medium

**M-1. `User.email` index unique, কিন্তু `func.lower(User.email) == normalized_email` query-তে index ব্যবহার হয় না**
- **অবস্থান:** `auth.py:50, 85, 128, 159`
- **ফিক্স:** `LowercaseEmail` Postgres-এ `CITEXT` column অথবা `LOWER(email)` functional index add করুন (`ensure_schema.py`-এ migration হিসেবে)।

**M-2. CSP `script-src 'unsafe-inline' 'unsafe-eval'` — XSS surface বড়**
- **অবস্থান:** `next.config.ts:163`
- **Trade-off:** Next.js inline runtime scripts + HLS.js-এর dynamic code path।
- **উন্নত ফিক্স:** `'unsafe-eval'` বাদ দিন (HLS.js `eval` ব্যবহার করে না); `'unsafe-inline'` শুধু nonce/hash-এর সাথে allow করুন (Next.js-এ `middleware.ts` থেকে nonce inject)।

**M-3. `setPlaybackQuality()` HLS.js-এ live stream-এ limited support — UX-এ misleading**
- **অবস্থান:** `PremiumPlayer.tsx:865-868`
- **ফিক্স:** UI-তে "Live = Auto only" label দেখান।

**M-4. `ErrorBoundary` শুধু window-level — render phase errors ধরে না**
- **অবস্থান:** `ErrorBoundary.tsx:15-92`
- **ফিক্স:** React class-based `componentDidCatch` অথবা `react-error-boundary` package যোগ করুন।

**M-5. `prune_non_default_users_on_startup=True` — ডিফল্ট non-prod-এ False, কিন্তু render.yaml-এ `True`**
- **ঝুঁকি:** যেকোনো user account deploy-এ মুছে যাবে (অ্যাডমিন বাদে)।
- **ফিক্স:** Public registration বন্ধ হলে এটা ঠিক, কিন্তু docs-এ স্পষ্ট উল্লেখ রাখুন। `/auth/register` route-টি open রাখা বা বন্ধ করা (admin toggle) — business decision।

**M-6. `get_password_hash` length truncation silently drops bytes — non-ASCII password data loss**
- **অবস্থান:** `security.py:20-25`
- **ঝুঁকি:** বাংলা password > 72 bytes → silently fail. Hashed value ≠ original.
- **ফিক্স:** Min length 8 (আছে) + UI-তে warning, অথবা `argon2` switch (RFC 9106 recommended)।

**M-7. `proxy/m3u8` ও `proxy/stream` দুটি route — কিন্তু dynamic stream pipeline ছাড়া সাধারণ stream `stream_id` query param গ্রহণ করে না**
- **অবস্থান:** `proxy.py:874, 1334`
- **মান:** ডিজাইন বাই ইনটেনশন, কিন্তু `/proxy/playlist` route ব্যবহার করলে `stream_id` পাস হয় না — header-preservation gap।
- **ফিক্স:** `/proxy/playlist?stream_id=…` ও পাস করার সুযোগ দিন।

**M-8. `asyncio.run_in_executor(None, …)` দুটি sync path-এ (stream_validator, jagobd) — APScheduler + admin route-এ চলে ঠিকই, কিন্তু `asyncio.get_event_loop()` deprecated on Python 3.12+**
- **অবস্ধান:** `stream_validator.py:155, 222`
- **ফিক্স:** `asyncio.get_running_loop()` ব্যবহার করুন।

### 3.5 🟢 Low

**L-1. `RunInThreadpool` 5m+ sync operations (M3U sync) admin request-এ 5m timeout — Render free tier health check-এ 30s response window। Sync request Render-এর একটি worker block করে — **ভালো, কিন্তু `asyncio.gather` admin stats-এর সাথে চললে UI ঝুলবে না।**
- **ফিক্স:** `run_in_threadpool` সব async-ভিত্তিক heavy ops-এ ব্যবহার হচ্ছে কিনা verify।

**L-2. `httpx.AsyncClient` instantiation per request (`_async_peek_stream`) — connection pool প্রতিবার recreate হচ্ছে**
- **অবস্ধান:** `proxy.py:511`
- **ফিক্স:** Module-level pool রাখুন, বা FastAPI dependency দিয়ে share।

**L-3. `Discourage comment "Run in CI or locally"` (`check_m3u_sources.py`) ভালো, কিন্তু exit code 1 ছাড়া Slack/webhook integration নেই — CI silent fail হতে পারে।**

**L-4. `Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges, Content-Type` — preflight-এ expose আছে, কিন্তু main handler-এ `Content-Range` passthrough নেই (`_FORWARD_UPSTREAM_HEADERS` allow-list)।
- **অবস্থান:** `proxy.py:390-396`
- **ফিক্স:** Range-based players (VLC, native HLS) এর জন্য যোগ করুন।

**L-5. `frontend/src/lib/fancodeLive.ts`, `crichdLive.ts`, `fancodeM3U.ts` — read করা হয়নি; verify that they don't expose secrets or scrape user data.**

---

## ৪. কোড কোয়ালিটি ও মেইনটেন্যাবিলিটি

### ✅ ভালো অনুশীলন

- **Docstring** সব service-এ পরিষ্কার, behaviour ও limitation স্পষ্ট।
- **Type hints** (Python) ও **TypeScript strict mode** (Next) — disciplined।
- **Field/model validator** ব্যবহার Pydantic v2 patterns অনুসরণ করে।
- **`logging.getLogger("app.<module>")`** — সব জায়গায় consistent namespace।
- **Retry with exponential backoff** (`automation.py:75-96`, `iptv_scraper.py:184-206`)।
- **DB connection pool** default-এ 3 + overflow 5 → Neon free 25 connection budget safe।
- **Cache versioning** (`_cache_version` increment in `invalidate_list_caches`) — previously missed, এখন fixed।
- **`_apply_db_statement_timeout`** 60s ceiling — DB এ hang হলে worker ব্লক হবে না।
- **`sync_rate_limit.py`** dual-lock (Redis + local) — multi-worker safe।

### 🟡 উন্নতির সুযোগ

- **DRY violation:** `_CHAN_NORM_RE` + `_CHAN_SUFFIX_NORM_RE` দুটো service-এ (`iptv_scraper.py` ও `channel_cleanup.py`) duplicated → shared util `app/utils/name_norm.py`।
- **`create_access_token(subject=str(user.id), is_admin=user.is_admin)`** — JWT payload-এ role claim; revocation list নেই (M-2)।
- **Frontend:** `lib/streamRelay.ts`, `lib/playlistFetch.ts` — review প্রয়োজন (আমার বিশ্লেষণের বাইরে)।
- **Frontend test setup নেই** — `pnpm test`/`vitest` script পাওয়া যায়নি (`package.json` scripts শুধু `dev`/`build`/`start`/`lint`).
- **Backend test setup নেই** — `requirements.txt`-এ pytest নেই।

### 🟢 Documentation Excellence

- `README.md` — branding-rich, social links, badges ভালো।
- `DEPLOYMENT.md` — free-tier aware, Render sleep + Neon pooler explained।
- `docs/ENV_COPY_PASTE.md` — full Bengali/English env table (158 lines) **outstanding**।
- Inline `dangerouslySetInnerHTML` schema.org JSON-LD — SEO-ready।

---

## ৫. ডিপেন্ডেন্সি ও ভালনারেবিলিটি

### Backend (Python)
| প্যাকেজ | সংস্করণ | মন্তব্য |
|---|---|---|
| fastapi | >=0.115.0 | ✅ Active, 0.118 available (minor update) |
| uvicorn[standard] | >=0.30.0 | ✅ uvloop + httptools |
| sqlalchemy[asyncio] | >=2.0.35 | ✅ v2 OK |
| asyncpg | >=0.30.0 | ✅ Neon compatible |
| psycopg[binary] | >=3.2.3 | ✅ v3 |
| python-jose | >=3.3.0 | ⚠️ Maintenance mode (last release 2022); consider `pyjwt` |
| passlib | >=1.7.4 | 🔴 See C-1 |
| bcrypt | >=4.0.1,<5.0.0 | 🟠 Major version constraint; just need verification with passlib |
| pydantic | >=2.9.2 | ✅ |
| pydantic-settings | >=2.5.2 | ✅ |
| m3u8 | >=4.0.0 | ✅ |
| redis | >=5.0.0 | ✅ |
| apscheduler | >=3.10.0 | ✅ |
| playwright | >=1.40.0 | ✅ but render.yaml `playwright install chromium --with-deps` doubles build time |
| aiohttp | >=3.9.0 | ✅ |

**⚠️ python-jose maintenance:** 2024-এ active fork `python-jose-fork` available, অথবা `pyjwt` (more secure, smaller dep tree)।

### Frontend (Node)
| প্যাকেজ | সংস্করণ | মন্তব্য |
|---|---|---|
| next | ^15.5.15 | ✅ Latest minor |
| react | ^19.1.0 | ✅ Stable |
| hls.js | ^1.6.2 | ✅ |
| dashjs | ^5.0.0 | ✅ |
| framer-motion | ^11.18.2 | ✅ |
| @ducanh2912/next-pwa | ^10.2.9 | ✅ PWA workbox integration |
| zustand | ^5.0.3 | ✅ |
| sonner | ^2.0.7 | ✅ |
| lucide-react | ^0.503.0 | ✅ |
| next-themes | ^0.4.6 | ✅ |
| @tanstack/react-table | ^8.21.3 | 🟡 Verify usage; not in main read paths |

**`overrides` block** (`package.json:37-40`) magic-string + glob — security advisory patched; ✅।

**❌ Snyk/OSV-Audit missing:** কোনো `pnpm audit` / `pip-audit` config নেই। GitHub Actions workflow পাওয়া যায়নি — `.github/workflows/` directory নেই।

---

## ৬. ডিপ্লয়মেন্ট ও অপারেশনস

### ✅ যা চমৎকার
- **Free-tier fit:** `DB_POOL_SIZE=3`, `MAX_ASYNC_WORKERS=50`, `MAX_SYNC_WORKERS=30` — Neon free 25 conn সম্মান।
- **Single Render instance** warning (DEPLOYMENT.md) — distributed scheduler duplicate রোধ।
- **Playwright disabled by default** (`M3U8_REFRESH_INTERVAL_MINUTES=0`) — free-tier RAM safe।
- **M3U caching** 25 min in Redis → upstream servers spared।
- **Probe cache** 10 min in Redis (`stream_probe.py:21`).
- **Health endpoints:** `/health` (cheap), `/health/db` (diagnostic, not exposed in OpenAPI by default — actually `include_in_schema=False`, ✅)।

### 🟡 যা উন্নত করা যায়
- **No CI/CD** — `.github/workflows/` নেই, lint/test/build automation নেই।
- **`prune_non_default_users_on_startup=True`** in render.yaml — first deploy-এ user গুলো মুছে যাবে; documentation-এ warning যোগ করুন।
- **Cron-based external sync** mention আছে কিন্তু GitHub Actions example নেই।
- **CDN cache invalidation** Vercel rewrite-এ manual — Vercel deploy-এ নতুন build → service worker version bump → পুরনো PWA clients cache clear, কিন্তু API cache (s-maxage 300) stale হতে পারে।

---

## ৭. পারফরম্যান্স ও স্কেলেবিলিটি

| Bottleneck | বর্তমান | সীমা | সুপারিশ |
|---|---|---|---|
| Render free sleep | 30-60s cold start | 15min idle | Paid tier for always-on |
| Neon free | 0.5GB storage, 25 conn | 191h compute/mo | Monitor pg_stat_activity |
| Single Render worker | `BackgroundScheduler` single instance | Multi-worker → duplicate sync | Sticky session + Redis lock (আছে) |
| M3U full index | `iptv_full_index_sync=True` (default) | Heavy memory | On free tier, disable |
| Playwright | Per-extraction browser launch | 500MB RAM | Pool size 1 max |
| Channel list page size | 500 max | Memory | Frontend batches 24/pagination |

**Redis-এ dedup** (`m3u_discovery._is_valid_m3u`) — duplicate URL re-validation 24h skip → মূল্যবান।

---

## ৮. টেস্টিং ও কোয়ালিটি অ্যাসুরেন্স

- ❌ **Unit tests:** কোনো `tests/` directory বা `test_*.py`/`*.test.ts` পাওয়া যায়নি।
- ❌ **Integration tests:** API smoke test শুধু `scripts/check_m3u_sources.py`।
- ❌ **E2E tests:** Playwright frontend-এ আছে, কিন্তু test runner হিসেবে নয়।
- ✅ **Smoke check script:** `check_m3u_sources.py` ভালো, কিন্তু CI integration নেই।
- ❌ **Linting enforcement:** `next lint` আছে, কিন্তু pre-commit/CI gate নেই।

**সুপারিশ:**
1. `backend/tests/test_security.py` — `verify_password` constant time, JWT expiry, SSRF blocks।
2. `backend/tests/test_proxy.py` — manifest rewriter, geo retry, rate limit।
3. `frontend/tests/` — vitest + React Testing Library for PremiumPlayer, authStore।
4. `tests/e2e/` — Playwright (already installed) for viewer + admin login flow।

---

## ৯. কোড স্মেল ও কমপ্লেক্সিটি

| ফাইল | LoC | জটিলতা | মন্তব্য |
|---|---|---|---|
| `backend/app/main.py` | 526 | High | Lifespan + scheduler + exception + multiple routes inline → split into `app/api/health.py` |
| `backend/app/api/routes/proxy.py` | 1409 | Very High | **⚠️ 1409 lines in one file** — split: `proxy/stream.py`, `proxy/playlist.py`, `proxy/m3u8.py`, `proxy/headers.py` |
| `frontend/src/components/PremiumPlayer.tsx` | 1526+ | Very High | Split: `useHlsPlayer`, `useGestures`, `useAutoRetry`, `useSleepTimer` |
| `backend/app/services/iptv_scraper.py` | 579 | Medium | OK, but `_CHAN_NORM_RE` duplication (see DRY) |
| `backend/app/services/automation.py` | 297 | Medium | Clean |

**Technical debt hotspots:**
- `proxy.py` (1409 LoC) — top priority refactor target।
- `PremiumPlayer.tsx` (1526+ LoC) — extract custom hooks।

---

## ১০. অ্যাকশন প্ল্যান (Priority Order)

### 🔴 এই সপ্তাহে (Critical)
1. **C-1** bcrypt/passlib compat verify + pin update।
2. **C-2** `token_version` column add করুন (server-side logout effective)।
3. **H-1** `Access-Control-Allow-Origin` echo strategy for proxy routes।

### 🟠 পরের ২ সপ্তাহে (High)
4. **H-2** `STREAM_UPSTREAM_INSECURE` env knob + warning log।
5. **H-3** X-Forwarded-For / CF-Connecting-IP trusted (with `TRUST_PROXY_HEADERS` flag)।
6. **H-4** `render.yaml` ADMIN_EMAIL value remove → `sync: false`।
7. **DRY** `_CHAN_NORM_RE` shared util।

### 🟡 পরের মাসে (Medium)
8. **M-1** Functional `LOWER(email)` index (Postgres)।
9. **M-2** CSP `'unsafe-eval'` remove; nonce-based inline script।
10. **M-4** Proper `ErrorBoundary` (react-error-boundary)।
11. Add **pytest + vitest** scaffolding।
12. Add **CI workflow** (lint + test + build) `.github/workflows/ci.yml`।
13. **Refactor** `proxy.py` (1409 → 4 files) এবং `PremiumPlayer.tsx` (custom hooks)।

### 🟢 Continuous Improvement
14. **Monitoring:** Render metrics + Sentry/OpenTelemetry integration।
15. **Multi-instance support:** জন্য distributed scheduler (e.g. `celery-beat` বা `Procrastinate`)।
16. **Frontend `lib/streamRelay.ts` ও অন্যান্য viewer lib** deep review।
17. **ADR (Architecture Decision Records)** directory তৈরি — কেন এই stack, কেন free-tier constraints।

---

## ১১. দ্রুত wins (< ১ ঘণ্টায়)

এই ৫টি ছোট পরিবর্তন এখনই করুন — high impact, low risk:

1. **`render.yaml`** — `ADMIN_EMAIL` এর `value` সরিয়ে `sync: false` করুন।
2. **`backend/app/main.py:368`** — `allow_credentials=True` → `allow_credentials=False` (cookie-based auth নেই)।
3. **`backend/app/core/sync_rate_limit.py`** rate-limit key তে `cf-connecting-ip` বা `x-forwarded-for` যোগ করুন (env-gated)।
4. **CSP `next.config.ts:163`** — `'unsafe-eval'` বাদ দিন (HLS.js এটি ব্যবহার করে না)।
5. **`backend/app/services/stream_validator.py:155, 222`** — `asyncio.get_event_loop()` → `asyncio.get_running_loop()`।

---

## ১২. চূড়ান্ত মতামত

প্রজেক্টটি **free-tier constraints-এর মধ্যে impressive engineering** দেখায়। M3U parsing, HLS proxying, geo-bypass, dynamic stream extraction (Playwright), live fixture sync, DRR (dead link detection), SSRF protection — সব production-grade।

**শক্তিশালী দিক:**
- Defensive coding (try/except, retries, fallbacks) সর্বত্র।
- Schema migrations without Alembic (ensure_schema.py) — startup-এ safe।
- Multi-layer caching (Redis → in-memory LRU → DB query)।
- Comprehensive docstrings।
- Bengali/English bilingual documentation — **outstanding**।

**দুর্বলতা:**
- টেস্টিং infrastructure অনুপস্থিত।
- CI/CD pipeline নেই।
- দুটো অতি-বড় ফাইল (proxy.py 1409, PremiumPlayer.tsx 1526+)।
- কিছু minor security hardening (JWT revoke, proxy header trust, TLS knob)।

**Overall: 7.5/10 — production-ready hardening-এর পর।**

আপনি চাইলে আমি যেকোনো নির্দিষ্ট সমস্যা (C-1, C-2, H-1 ইত্যাদি) **ঠিক করে দিতে পারি** — বলুন কোনটা দিয়ে শুরু করব।

---

*Audit performed on commit `d5ab1d0afc390de4a2c6b0cc6b745b0740303cc9` by surgical code review across backend, frontend, and ops layers।*
*Generated: 2026-06-09 04:35 (Asia/Dhaka)।*


