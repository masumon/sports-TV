# Render + Vercel + Neon + Redis — অপারেশন গাইড (কপি-পেস্ট)

## ১) আপনার বর্তমান Render env — ঠিক কি, কি বদলাবেন

### ঠিক আছে (এইভাবেই রাখতে পারেন)

- `APP_ENV=production`, `DEBUG=false`
- `DATABASE_URL` = Neon pooler URL (কোডে `channel_binding` স্বয়ংক্রিয় ঠিক হয়)
- `CORS_ORIGINS=https://sports-tv-lovat.vercel.app` — মূল সাইট OK
- কোডে **Vercel Preview** (`https://*.vercel.app`) CORS regex দিয়ে যুক্ত; অতিরিক্ত preview URL বার বার যোগ করতে হবে না
- `REDIS_URL` — অপশনাল; না থাকলে ক্যাশ বন্ধ, অ্যাপ চলে

### অবশ্যই করুন (নিরাপত্তা — এগুলো চ্যাট/স্ক্রিনশটে শেয়ার করবেন না)

1. **JWT / অ্যাডমিন**  
   - `JWT_SECRET_KEY` → টার্মিনালে: `openssl rand -hex 32` — আউটপুট পুরোটা Render-এ পেস্ট  
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` — জানা টেস্ট মান এড়িয়ে শক্ত পাসওয়ার্ড দিন

2. **Neon / Redis পাসওয়ার্ড লিক হলে**  
   - Neon dashboard → rotate password → `DATABASE_URL` আপডেট  
   - Redis Cloud → rotate → `REDIS_URL` আপডেট

3. **Redis SSL**  
   - যদি লগে `Redis unavailable` দেখেন, Redis Cloud এ **SSL / rediss://** URL অনুসরণ করুন (পোর্ট/URL ড্যাশবোর্ডের মতো)

### Internal sync (শুধু যদি ক্রন/ওয়েবহুক দিয়ে `POST /internal/sync` চালান)

Render → **Add Environment Variable**:

| Key | Value (উদাহরণ — নিজেরটা বানান) |
|-----|--------------------------------|
| `INTERNAL_SYNC_SECRET` | `openssl rand -hex 32` এর আউটপুট |

কল করার সময় হেডার:

```http
X-Sync-Secret: <আপনার_একই_সিক্রেট>
```

প্রোড-এ সিক্রেট না থাকলে এই এন্ডপয়েন্ট **503** দেবে (ইচ্ছাকৃত)। ক্রন না থাকলে ইগনোর করুন।

---

## ২) Vercel (Frontend)

অনুমান: `NEXT_PUBLIC_API_BASE_URL=/api`, `BACKEND_URL=https://gstv-backend.onrender.com`, `NEXT_PUBLIC_SITE_URL=https://sports-tv-lovat.vercel.app`  
**খালি স্ট্রিং সেভ করবেন না** — ফাঁকা হলে কোড বিল্ট-ইন ডিফল্ট ব্যবহার করে।

---

## ৩) দ্রুত স্বাস্থ্য পরীক্ষা

```bash
curl -sS "https://gstv-backend.onrender.com/health"
curl -sS "https://gstv-backend.onrender.com/health/db"
```

`health/db` এ `"db":"ok"` হওয়া চাই।

---

## ৪) কি করবেন না

- `DATABASE_URL` এ ধারণকৃত পাসওয়ার্ড **রিপোতে** কমিট করবেন না
- প্রোড `APP_ENV` এ SQLite ব্যবহার করবেন না (কোড production এ PostgreSQL বাধ্য)
- `POST /internal/sync` পাবলিক ক্রন ছাড়া এক্সপোজ করবেন না — সবসময় `INTERNAL_SYNC_SECRET` + হেডার
