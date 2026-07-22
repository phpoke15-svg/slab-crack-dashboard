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
- `FIREBASE_SERVICE_ACCOUNT_PATH` — path to Firebase Admin JSON key
- `FCM_TOPIC` — defaults to `pokemon_center_alerts`

## Detection logic

1. Sends `HEAD` requests every 5 seconds (headers only, no body download)
2. Marks queue **LIVE** when status is `302`/`307` and `Location` points at `queue.pokemoncenter.com`, `queue-it.net`, or `queue-it.com`
3. Debounces alerts: **2 consecutive LIVE hits within 10 seconds** before sending FCM
4. Broadcasts to FCM topic with payload `{ url: "..." }`

## Mobile token subscription

The worker exposes `POST /subscribe` on `SUBSCRIBE_PORT` (default `8787`):

```json
{ "token": "<native FCM device token>" }
```

Mobile apps should register for push, obtain a native device token (`expo-notifications` → `getDevicePushTokenAsync`), and POST it here so Firebase Admin can subscribe the device to `pokemon_center_alerts`.
