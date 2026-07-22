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

Queue probes run **Monday through Friday, 9:30 AM – 4:00 PM Eastern** (`America/New_York`, DST-aware). `isWithinMonitoringWindow()` enforces the exact start/end times (including minutes — checks begin at 9:30 AM ET and stop at 4:00 PM ET). Inside that window the worker runs a **90-second loop** (`CHECK_INTERVAL_MS = 90_000`): each check completes, logs a wait message, then sleeps 90s before the next cycle.

Outside that window the worker logs a skip message and makes **no HTTP or proxy requests**, waiting 90s before polling the clock again. The FCM subscribe API remains available 24/7.

## Detection logic

1. Opens **headless Chromium** (Playwright + stealth plugin) every 90 seconds during the operating window
2. **Blocks images, fonts, CSS, and media** via route interception to minimize proxy bandwidth
3. Routes browser traffic through IPRoyal (`IPROYAL_*` or legacy `PROXY_*` env vars)
4. Waits for DOM content + 5s so Imperva JavaScript challenges can render (avoids brittle `networkidle` timeouts)
5. Marks queue **LIVE** on queue redirects, Queue-it HTML/title markers, or queue hostnames in the final URL
6. Treats Imperva block/challenge pages as **blocked** (logged cleanly, no crash, no false alerts)
7. Debounces alerts: **2 consecutive LIVE hits within 7 minutes** before dispatching notifications
8. Closes browser context after each probe to limit memory use

## Notification dispatch

When a queue is confirmed live, the worker **enqueues alerts asynchronously** so the Playwright loop never blocks on push APIs.

`src/services/notificationService.ts` orchestrates:

1. **Cooldown** — default 20 minutes (`NOTIFICATION_COOLDOWN_MS`), stored in memory or Upstash Redis (`UPSTASH_REDIS_REST_*`)
2. **OneSignal** — `POST https://onesignal.com/api/v1/notifications` targeting subscribers tagged `membership_tier = pro` or `supreme` (`ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`)
3. **FCM topic broadcast** — existing Firebase Admin topic send for native mobile subscribers
4. **WebSocket** — instant `QUEUE_DETECTED` event to online clients at `ws://HOST:PORT/ws`
5. **Redis pub/sub** — optional publish to `NOTIFICATION_REDIS_CHANNEL` (default `queue:detected`) for downstream consumers

Push title: **🚨 Queue Live: Pokémon Center!** — opens `https://www.pokemoncenter.com` (or `QUEUE_DEEP_LINK`).

## Failure alerting

Unexpected probe errors and **2+ consecutive navigation failures** trigger `sendFailureAlert()`:

- OneSignal push to subscribers tagged `role = admin` or `membership_tier = supreme`
- Includes ISO timestamp and error message
- Rate-limited to **1 alert per 60 minutes** by default (`FAILURE_ALERT_COOLDOWN_MS = 3600000`)

Requires `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY` on Railway.

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

## Test queue-live alerts

Use these endpoints to verify push delivery without waiting for a real queue drop.

### Railway worker (OneSignal pro/supreme + FCM topic + WebSocket)

Set `WORKER_TEST_SECRET` on Railway (or reuse the same value as Vercel `CRON_SECRET`).

```bash
curl -sS -X POST "https://<your-railway-domain>/test/queue-live?force=1" \
  -H "Authorization: Bearer $WORKER_TEST_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"status":302}'
```

- Omit `?force=1` to exercise the normal 20-minute cooldown (`NOTIFICATION_COOLDOWN_MS`).
- Response includes `oneSignalId`, `fcmMessageId`, and `websocketClients`.

### Vercel web push (Pro/Supreme on `/pokewatch`)

```bash
curl -sS -X POST "https://collectools.app/api/pokemon-center/test-queue-alert?force=1" \
  -H "Authorization: Bearer $CRON_SECRET"
```

- Sends a labeled **(TEST)** queue-live push to subscribers who opted in on `/pokewatch`.
- Without `?force=1`, respects the 5-minute web-push dedupe window.
