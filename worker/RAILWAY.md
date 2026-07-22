# Deploy on Railway

This worker is a **long-running process** (not serverless). Railway is the right host for 5-second weekday polling.

## 1. Create a service from GitHub

1. In [Railway](https://railway.app), open your project linked to this repo.
2. **New → GitHub Repo** (or add a service to the existing project).
3. Deploy branch **`main`**.
4. **Recommended:** set **Root Directory** to `worker` (uses `worker/Dockerfile` + `worker/railway.toml`).
5. If Root Directory is empty, Railway uses root `Dockerfile.worker` instead.

**Do not** set Start Command to `npm start` — that runs **Next.js** and will fail.

| Setting | Value |
|---|---|
| Root Directory | `worker` (recommended) |
| Start Command | leave empty (uses `node dist/worker.js` from railway.toml) |

Successful deploy logs:

```
[worker] Pokémon Center queue detector started
[worker] Queue probe transport=playwright-stealth profile=chromium-desktop-stealth
[worker] Current Proxy IP: ...
[worker] FCM subscribe API listening on 0.0.0.0:8080/subscribe
```

**Note:** Docker builds install Chromium via `npx playwright install --with-deps chromium` (required for headless browser probes).

## 2. Required environment variables

**IPRoyal (preferred):**

| Variable | Description |
|---|---|
| `IPROYAL_HOST` | e.g. `geo.iproyal.com` |
| `IPROYAL_PORT` | e.g. `12321` |
| `IPROYAL_USER` | IPRoyal username |
| `IPROYAL_PASS` | IPRoyal password + flags, e.g. `yourpass_country-us` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full Firebase Admin JSON pasted as one line |

**Legacy aliases** (`PROXY_HOST`, `PROXY_PORT`, `PROXY_USERNAME`, `PROXY_PASSWORD`) still work if `IPROYAL_*` is not set.

Optional:

| Variable | Default |
|---|---|
| `TARGET_URL` | `https://www.pokemoncenter.com/` |
| `QUEUE_DEEP_LINK` | `https://www.pokemoncenter.com/` |
| `FCM_TOPIC` | `pokemon_center_alerts` |

Railway sets `PORT` automatically — the subscribe API listens on it.

## 3. Networking

Enable **Public Networking** on the Railway service so mobile apps can reach:

```
https://<your-railway-domain>/subscribe
https://<your-railway-domain>/health
```

Update `mobile-app/app.json`:

```json
"extra": {
  "subscribeApiUrl": "https://<your-railway-domain>/subscribe"
}
```

## 4. Deploy branch

Point the Railway service at the branch with the worker (e.g. `cursor/pokemon-center-queue-worker-e84c` or `main` after merge).

## 5. Verify

- Logs should show: `Queue checks scheduled Mon-Fri 9:00 AM - 5:00 PM America/New_York every 5s`
- Outside business hours: `Idle outside scheduled hours — no HTTP or proxy requests`
- `GET /health` returns `{ "ok": true }`

## Vercel vs Railway

| | Vercel | Railway |
|---|---|---|
| Next.js site | Yes | No |
| `/worker` 5s polling | No (cron limits) | Yes |
| `/api/check-queue` daily cron | Yes (`vercel.json`) | Separate from this worker |
