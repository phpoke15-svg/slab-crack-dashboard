# Deploy on Railway

This worker is a **long-running process** (not serverless). Railway is the right host for 5-second weekday polling.

## 1. Create a service from GitHub

1. In [Railway](https://railway.app), open your project linked to this repo.
2. **New → GitHub Repo** (or add a service to the existing project).
3. Set **Root Directory** to `worker` (important — repo root `npm start` runs **Next.js**, not the worker).
4. Railway reads `worker/railway.toml` automatically (`startCommand = npm run start:worker`).

If you must deploy from the repo root instead, set Railway **Start Command** to:

```bash
npm run start:worker
```

## 2. Required environment variables

| Variable | Description |
|---|---|
| `PROXY_HOST` | Proxy hostname |
| `PROXY_PORT` | Proxy port |
| `PROXY_USERNAME` | Proxy user (if required) |
| `PROXY_PASSWORD` | Proxy password (if required) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full Firebase Admin JSON pasted as one line (recommended on Railway) |

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
