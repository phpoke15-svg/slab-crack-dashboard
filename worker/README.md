# Pokémon Center Queue Detector Worker

Standalone Node.js worker that polls Pokémon Center through a proxy, detects virtual queue redirects, and broadcasts FCM alerts.

## Setup

```bash
cd worker
cp env.example .env
# Add proxy credentials + firebase-service-account.json
npm install
npm run dev
```

## Environment

See `env.example` for all variables. Required proxy (either naming scheme):

- `IPROYAL_HOST`, `IPROYAL_PORT`, `IPROYAL_USER`, `IPROYAL_PASS` — preferred on Railway
- or `PROXY_HOST`, `PROXY_PORT`, `PROXY_USERNAME`, `PROXY_PASSWORD` — legacy aliases
- `FIREBASE_SERVICE_ACCOUNT_JSON` — full Firebase Admin JSON (Railway) **or** `FIREBASE_SERVICE_ACCOUNT_PATH` locally
- `FCM_TOPIC` — defaults to `pokemon_center_alerts`

**Railway:** see [RAILWAY.md](./RAILWAY.md) — set service **Root Directory** to `worker`.

## Schedule

Queue probes run **Monday through Friday, 9:00 AM – 5:00 PM Eastern** (`America/New_York`, DST-aware) via `node-cron` using a **6-field** expression (seconds first):

```
0 */3 * 9-16 * * 1-5
```

Every **3 minutes** during business hours (`CHECK_INTERVAL_MS = 180_000`). Outside that window the worker stays idle and makes **no HTTP or proxy requests**. The FCM subscribe API remains available 24/7.

## Detection logic

1. Opens **headless Chromium** (Playwright + stealth plugin) every 3 minutes on the cron schedule
2. **Blocks images, fonts, CSS, and media** via route interception to minimize proxy bandwidth
3. Routes browser traffic through IPRoyal (`IPROYAL_*` or legacy `PROXY_*` env vars)
4. Waits for network idle + 5s so Imperva JavaScript challenges can render
5. Marks queue **LIVE** on queue redirects, Queue-it HTML/title markers, or queue hostnames in the final URL
6. Treats Imperva block/challenge pages as **blocked** (logged cleanly, no crash, no false alerts)
7. Debounces alerts: **2 consecutive LIVE hits within 7 minutes** before sending FCM
8. Closes browser context after each probe to limit memory use

## Playwright setup (local)

```bash
cd worker
npm install
npx playwright install --with-deps chromium   # Linux/Railway needs system deps
npm run dev
```

Railway Docker builds run `npx playwright install --with-deps chromium` automatically.

## Mobile token subscription

The worker exposes `POST /subscribe` on `SUBSCRIBE_PORT` (default `8787`):

```json
{ "token": "<native FCM device token>" }
```

Mobile apps should register for push, obtain a native device token (`expo-notifications` → `getDevicePushTokenAsync`), and POST it here so Firebase Admin can subscribe the device to `pokemon_center_alerts`.
