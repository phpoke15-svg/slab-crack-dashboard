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

See `env.example` for all variables. Required:

- `PROXY_HOST`, `PROXY_PORT` — proxy used by `HttpsProxyAgent`
- `FIREBASE_SERVICE_ACCOUNT_JSON` — full Firebase Admin JSON (Railway) **or** `FIREBASE_SERVICE_ACCOUNT_PATH` locally
- `FCM_TOPIC` — defaults to `pokemon_center_alerts`

**Railway:** see [RAILWAY.md](./RAILWAY.md) — set service **Root Directory** to `worker`.

## Schedule

Queue probes run **Monday through Friday, 9:00 AM – 5:00 PM Eastern** (`America/New_York`, DST-aware) via `node-cron` using a **6-field** expression (seconds first):

```
*/5 * 9-16 * * 1-5
```

Every **5 seconds** during business hours. Outside that window the worker stays idle and makes **no HTTP or proxy requests**. The FCM subscribe API remains available 24/7.

## Detection logic

1. Sends browser-like `GET` requests every 5 seconds on the cron schedule above (Imperva often blocks bare `HEAD` probes)
2. Rotates User-Agent / Accept-Language profiles every 5 minutes
3. Marks queue **LIVE** on queue redirects (`301`/`302`/`307`/`308`), queue response headers, or Queue-it HTML markers
4. Treats `403` / Imperva challenge pages as **blocked** (no false alerts)
5. Debounces alerts: **2 consecutive LIVE hits within 15 seconds** before sending FCM
6. Broadcasts to FCM topic with payload `{ url: "..." }`

## Mobile token subscription

The worker exposes `POST /subscribe` on `SUBSCRIBE_PORT` (default `8787`):

```json
{ "token": "<native FCM device token>" }
```

Mobile apps should register for push, obtain a native device token (`expo-notifications` → `getDevicePushTokenAsync`), and POST it here so Firebase Admin can subscribe the device to `pokemon_center_alerts`.
