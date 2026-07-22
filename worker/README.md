# CollecTools Queue Alert Worker

Standalone Node.js worker that receives **inbound queue-drop webhooks** and dispatches push alerts to Pro and Supreme members.

## Setup

```bash
cd worker
cp env.example .env
# Set WEBHOOK_SECRET, OneSignal, and optional Firebase credentials
npm install
npm run dev
```

## Default mode: webhook receiver

The worker listens on `PORT` (Railway sets this automatically; local default **3000**).

### POST `/api/webhook/queue-alert`

Authorized alert services POST JSON drop details here. The worker validates a shared secret, deduplicates alerts for **15 minutes**, and dispatches notifications asynchronously.

**Auth (pick one):**

- Header: `X-Webhook-Secret: $WEBHOOK_SECRET`
- Header: `Authorization: Bearer $WEBHOOK_SECRET`
- Query: `?secret=$WEBHOOK_SECRET`

**Example payload:**

```json
{
  "siteTitle": "Pokémon Center",
  "dropUrl": "https://www.pokemoncenter.com/",
  "productName": "151 Booster Bundle",
  "status": 302
}
```

**Example request:**

```bash
curl -sS -X POST "https://<your-railway-domain>/api/webhook/queue-alert" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "siteTitle": "Pokémon Center",
    "dropUrl": "https://www.pokemoncenter.com/",
    "productName": "151 Booster Bundle"
  }'
```

Returns **`200 OK` immediately** after validation. Duplicate webhooks inside the cooldown window are accepted but do not re-notify users.

## Notification dispatch

`src/services/notificationService.ts` orchestrates:

1. **Cooldown** — default **15 minutes** (`NOTIFICATION_COOLDOWN_MS=900000`), stored in memory or Upstash Redis
2. **OneSignal** — pro/supreme subscribers (`ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`)
3. **FCM topic broadcast** — native mobile subscribers (`FIREBASE_SERVICE_ACCOUNT_JSON`, `FCM_TOPIC`)
4. **WebSocket** — instant `QUEUE_DETECTED` event to online clients at `ws://HOST:PORT/ws`
5. **Redis pub/sub** — optional publish to `NOTIFICATION_REDIS_CHANNEL`

Custom webhook fields map into push copy:

- `siteTitle` → push heading
- `productName` → push body
- `dropUrl` / `url` → deep link

## Other endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Railway health check |
| `POST` | `/subscribe` | Subscribe native FCM device token to topic |
| `POST` | `/test/queue-live` | Manual test dispatch (`Authorization: Bearer $WORKER_TEST_SECRET`) |
| `WS` | `/ws` | Live queue-detected events |

## Legacy probe mode

Set `WORKER_MODE=probe` to restore the old Playwright browser poller (requires proxy env vars + `npm run postinstall:probe`).

## Railway

See [RAILWAY.md](./RAILWAY.md). Set service **Root Directory** to `worker`.

Required env vars for webhook mode:

- `WEBHOOK_SECRET`
- `ONESIGNAL_APP_ID` + `ONESIGNAL_REST_API_KEY` (recommended)
- `FIREBASE_SERVICE_ACCOUNT_JSON` (optional, for native FCM)

Optional:

- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for cross-instance dedupe
