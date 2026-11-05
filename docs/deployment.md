# Hosted demo

CliniX Core can run as one public URL, the same way CliniX Insight does: **MongoDB Atlas** holds the chart, and **one Render web service** serves both the API and the React app.

GitHub stores the code. Atlas and Render hold the database and the running site. Do the steps in order. The clinic board (today's schedule, waiting room, dashboard) matches the day you seed, so repeat steps 4 and 5 when you want that board to show the current clinic day. Patient charts such as Ava Nguyen stay useful either way.

## 1. Push the repo to GitHub

From the project folder, commit the deploy files and push to GitHub. Render deploys from that repo. The root directory of the service must be the repository root, not `frontend/` or `backend/`.

## 2. Create MongoDB Atlas

1. Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a **free M0** cluster.
3. **Database Access** → add a database user and a password.
4. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`). Render has no fixed IP on the free plan.
5. **Database** → **Connect** → **Drivers** → copy the connection string.
6. Replace `<password>` with the database user's password. If the password contains `@`, `:`, `/`, or `#`, URL-encode those characters. Set the database name to `clinix_core`:

```text
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/clinix_core?retryWrites=true&w=majority
```

## 3. Run the app locally once

MongoDB must be listening on `mongodb://127.0.0.1:27017`.

```powershell
npm install
Copy-Item backend\.env.example backend\.env
npm run seed
```

`npm run seed` only writes to localhost. That is intentional.

## 4. Copy the seeded database to Atlas

In the same PowerShell window:

```powershell
$env:TARGET_MONGODB_URI = "mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/clinix_core?retryWrites=true&w=majority"
npm run db:push
```

This reads the local database and replaces the collections on Atlas. It refuses to read from a remote host or to write onto localhost. When the command finishes, Atlas holds the demo logins and Ava Nguyen (MRN-1001).

## 5. Deploy on Render

### Blueprint

1. In [Render](https://dashboard.render.com) → **New** → **Blueprint**.
2. Connect the GitHub repo. Render reads `render.yaml`.
3. When prompted, set **`MONGODB_URI`** to the same Atlas string from step 2.
4. Deploy.

### Manual web service

Use this if you create the service yourself.

| Setting | Value |
| --- | --- |
| Root directory | repository root |
| Build command | `npm install --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/v1/health` |

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas connection string |
| `JWT_SECRET` | Generate a long random value. Do not use the value in `backend/.env.example` |
| `JWT_EXPIRES_IN` | `7d` |

`npm start` does not seed. Seeding on boot would wipe the clinic and is too large for Render's free instance. Load data with `npm run db:push` from your machine.

The UI calls `/api/v1` on the same host, so you do not set `VITE_API_URL`. Render sets `RENDER_EXTERNAL_URL`, and the API allows that origin. Set `CLIENT_ORIGIN` to the public site URL only if you later host the UI somewhere else.

## 6. Check the live site

- `https://YOUR-SERVICE.onrender.com/api/v1/health` returns `{"status":"ok","service":"clinix-core"}`.
- `https://YOUR-SERVICE.onrender.com` opens the clinic.
- Sign in as `doctor@clinix.local` / `Doctor123!`.
- Open **Ava Nguyen (MRN-1001)**.

The free Render service sleeps after inactivity. The first visit after that can take about half a minute.

Say on the portfolio page that the chart is synthetic. The demo passwords are public on purpose. This is not a system for real patient information.

## 7. Add it to the portfolio

Put the Render URL on the project as `demoUrl`, the same way the hotel simulator and BERMS are linked.

## Refresh today's clinic

The waiting room and today's schedule are dated to the seed. Charts are not.

1. On your machine: `npm run seed`
2. `npm run db:push` with `TARGET_MONGODB_URI` still set
3. Wait for Render to finish its next restart, or restart the service so it reconnects to the replaced data

`db:push` replaces Atlas collections. Anything a visitor typed into the live demo is removed.

## What production start does

```text
npm run build     frontend Vite bundle, then backend TypeScript
npm start         Express on PORT
                  serves frontend/dist
                  SPA routes fall back to index.html
                  /api/v1 stays the API
```

Local `npm run dev` is unchanged: Vite on port 5173, API on port 5000.

`NODE_ENV=production` closes open registration. Only an admin can call `POST /auth/register`. The process exits on boot if `MONGODB_URI` or `JWT_SECRET` is missing, or if `JWT_SECRET` is still a development placeholder.
