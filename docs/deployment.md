# Deploying CliniX Core

CliniX Core can run online with **MongoDB Atlas** (cloud database) plus a **Node.js host** (Render, Railway, etc.). GitHub stores code only — you connect the host to your repo and set environment variables there.

Two layouts work. They are the same layouts as CliniX Insight.

| Layout | Best for | Hosts |
|--------|----------|-------|
| **Monolith (recommended)** | Portfolio / demo — one URL | Render free tier |
| **Split** | Frontend CDN + separate API | Vercel/Netlify + Render |

The clinic board (today's schedule, waiting room, dashboard) matches the day the database was seeded. Patient charts such as Ava Nguyen stay useful either way. Say on the portfolio page that the chart is synthetic. The demo passwords are public on purpose. This is not a system for real patient information.

---

## 1. Create MongoDB Atlas (free)

1. Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a **free M0 cluster**.
3. **Database Access** → add a database user (username + password).
4. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`) so Render can connect. (Tighten this later if you add a fixed IP.)
5. **Database** → **Connect** → **Drivers** → copy the connection string.
6. Replace `<password>` with your user's password. If the password contains `@`, `:`, `/`, or `#`, URL-encode those characters. Set the database name to `clinix_core`:

   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/clinix_core?retryWrites=true&w=majority
   ```

Atlas is your production database. Do not point `MONGODB_URI` at localhost in production.

---

## 2. Monolith deploy on Render (easiest)

One service serves both the API and the React app.

### Option A — Blueprint (fastest)

1. Push the repo to GitHub.
2. In [Render](https://render.com) → **New** → **Blueprint** → connect the repo (`render.yaml` is included).
3. When prompted, set **`MONGODB_URI`** to your Atlas string.
4. Optionally set **`FRONTEND_URL`** to your Render URL (e.g. `https://clinix-core.onrender.com`). Render also sets `RENDER_EXTERNAL_URL` automatically for CORS.
5. Deploy. First boot, with `SEED_DEMO_DATA=true`, loads the clinic demo when that database is still empty.

The root directory of the service must be the repository root, not `frontend/` or `backend/`.

### Option B — Manual web service

| Setting | Value |
|---------|--------|
| **Root directory** | repository root |
| **Build command** | `npm install --include=dev && npm run build` |
| **Start command** | `npm start` |
| **Health check path** | `/api/v1/health` |

**Environment variables:**

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Your Atlas connection string |
| `JWT_SECRET` | Long random string (Render can generate one). Do not use the value in `.env.example` |
| `JWT_EXPIRES_IN` | `7d` |
| `SEED_DEMO_DATA` | `true` (demo portfolio) or omit for an empty database |
| `FRONTEND_URL` | `https://YOUR-SERVICE.onrender.com` |

### After deploy

- Open `https://YOUR-SERVICE.onrender.com/api/v1/health` — should return `{"status":"ok","service":"clinix-core"}`.
- Open the root URL — the clinic login page.
- Sign in as `doctor@clinix.local` / `Doctor123!` and open **Ava Nguyen (MRN-1001)**.

**Free tier note:** Render spins down after inactivity; the first request may take ~30 seconds. The first seed builds a 500-patient panel, so that first boot can take several minutes. Later restarts skip the seed while the demo marker is present.

The UI calls `/api/v1` on the same host, so a monolith deploy does not set `VITE_API_URL`.

---

## 3. Split deploy (Vercel frontend + Render API)

Use this if you want the UI on a CDN and the API elsewhere.

### Backend (Render)

Same as above, but **do not** rely on the API serving static files. Set:

| Variable | Value |
|----------|--------|
| `CORS_ORIGINS` | `https://your-app.vercel.app` |
| `FRONTEND_URL` | `https://your-app.vercel.app` |

### Frontend (Vercel)

1. Import the repo; set **Root Directory** to `frontend`.
2. **Build command:** `npm run build`
3. **Output directory:** `dist`
4. **Environment variable (build time):**

   ```
   VITE_API_URL=https://your-api.onrender.com
   ```

5. Deploy. The app calls the remote API; `frontend/vercel.json` handles SPA routing.

**Netlify:** the repo root `netlify.toml` builds from the monorepo root and publishes `frontend/dist` (with SPA redirects). In Netlify → Site configuration → Environment variables set:

```
VITE_API_URL=https://your-api.onrender.com
```

Then **trigger a new deploy** (Vite bakes this in at build time). On Render, set `FRONTEND_URL` and `CORS_ORIGINS` to your Netlify URL (e.g. `https://your-site.netlify.app`).

`VITE_API_URL` is the API origin only: no trailing slash and no `/api/v1` suffix. The app adds `/api/v1`.

**Important:** the connection string must use the database name `clinix_core`. A different database name is an empty clinic, and login fails until that database is seeded.

---

## 4. What `npm start` does in production

```
scripts/production-start.mjs
  → tsx backend/src/db/seed.ts   (only if SEED_DEMO_DATA=true and the demo is not already loaded)
  → backend dist/index.js     (Express on PORT, serves frontend/dist)
```

`npm run build` runs first on the host: the Vite bundle, then the TypeScript API. Local `npm run dev` is unchanged — Vite on port 5173, API on port 5000.

`SEED_DEMO_DATA=true` loads the demo once. A later boot sees the finished seed and leaves it in place, so a free-tier restart does not wipe the clinic. Set `SEED_FORCE=true` for one boot when you want that database replaced. Re-seeding **wipes and reloads** the demo, including anything a visitor typed.

`NODE_ENV=production` closes open registration. Only an admin can call `POST /auth/register`. The process exits on boot if `MONGODB_URI` or `JWT_SECRET` is missing, or if `JWT_SECRET` is still a development placeholder.

`npm run seed` on your machine still refuses any host other than localhost. The hosted seed runs only when `SEED_DEMO_DATA=true`.

---

## 5. Environment reference

| Variable | Required in prod | Purpose |
|----------|------------------|---------|
| `MONGODB_URI` | Yes | Atlas connection string, database `clinix_core` |
| `JWT_SECRET` | Yes | Must not be the dev default |
| `JWT_EXPIRES_IN` | No | Token lifetime. Blueprint sets `7d` |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | Auto | Set by Render/Railway |
| `FRONTEND_URL` | Recommended | CORS allow-list |
| `CLIENT_ORIGIN` | Optional | Extra allowed browser origin. Same role as `FRONTEND_URL` |
| `CORS_ORIGINS` | Split deploy | Comma-separated extra origins |
| `VITE_API_URL` | Split deploy | Backend URL at **frontend build** time |
| `SEED_DEMO_DATA` | Optional | `true` loads the demo when the database is empty |
| `SEED_FORCE` | Optional | `true` replaces an existing hosted demo on that boot |

---

## 6. Verify locally before pushing

Simulate production with Atlas:

```bash
# In .env:
# MONGODB_URI=mongodb+srv://...
# JWT_SECRET=<long-random-string>
# NODE_ENV=production
# SEED_DEMO_DATA=true

npm run build
npm start
```

Open http://localhost:5000 — you should see the app and `/api/v1/health` should respond.

Copy `.env.example` to `.env` at the repo root for local development. If `backend/.env` is already present, that file wins and the root `.env` only fills keys it does not set.

---

## 7. Refresh today's clinic

The waiting room and today's schedule are dated to the seed. Charts are not.

On the hosted service, set `SEED_FORCE=true`, let that boot finish, then remove `SEED_FORCE` so the next restart does not wipe the clinic again.

From your machine, the older copy path still works when you would rather not seed inside Render:

```powershell
npm run seed
$env:TARGET_MONGODB_URI = "mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/clinix_core?retryWrites=true&w=majority"
npm run db:push
```

`npm run db:push` reads localhost only and replaces the Atlas collections. Anything a visitor typed into the live demo is removed. Restart the Render service afterward so it reconnects to the replaced data.

---

## 8. Security checklist

- Never commit `.env` (it is in `.gitignore`).
- Use a strong `JWT_SECRET` in production.
- Restrict Atlas **Network Access** when you have a stable deploy IP.
- Turn off `SEED_DEMO_DATA` once you no longer want a public demo dataset, and do not leave `SEED_FORCE=true` set.
