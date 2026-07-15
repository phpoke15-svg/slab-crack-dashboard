# Remote PokeWatch worker (Fly.io / Railway)

Headless Playwright monitor for Pokemon Center. Runs **Mon–Fri 10am–3pm ET**, detects Imperva human verification and Queue-it, and POSTs to CollecTools so **all opted-in Pro users** get web push.

## Prerequisites

1. Merge & deploy PR with PokeWatch fixes + worker auth
2. Vercel env: `QUEUE_WATCH_WORKER_SECRET` (random 32+ chars)
3. Supabase: `web-push.sql` + `queue-watch.sql` already run
4. VAPID keys set on Vercel (`phoneAlerts: true` on `/api/health`)

## Step 1 — Generate worker secret

```bash
openssl rand -hex 32
```

Add to **Vercel** (Production):

```
QUEUE_WATCH_WORKER_SECRET=<paste>
```

Redeploy CollecTools.

## Step 2 — Install locally (for bootstrap)

```bash
cd scripts/queue-watch-worker
cp .env.example .env
# Edit .env — paste the same QUEUE_WATCH_WORKER_SECRET
npm install
```

## Step 3 — Bootstrap Imperva cookies (one time)

Use the **same proxy** you will use in production (if any).

```bash
npm run bootstrap
```

1. Browser opens `pokemoncenter.com`
2. Complete the Imperva checkbox / image CAPTCHA
3. Confirm the normal storefront loads
4. Press Enter in the terminal

Cookies are saved to `./pc-profile/`.

## Step 4 — Test report to CollecTools

```bash
curl -sS -X POST "$COLLECTOOLS_URL/api/pokemon-center/report" \
  -H "Authorization: Bearer $QUEUE_WATCH_WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "remote-monitor-fly",
    "live": false,
    "signals": [{"id":"imperva-human-verify","label":"Bootstrap test","confidence":95}],
    "source": "server",
    "pageUrl": "https://www.pokemoncenter.com/"
  }'
```

Expect `{"ok":true,...}`. Pro users with phone alerts may get a test push (30m dedupe applies).

## Step 5 — Deploy to Fly.io

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login

# From repo root — first time only
fly apps create collectools-pokewatch-worker
fly volumes create pc_profile --region iad --size 1

fly secrets set \
  QUEUE_WATCH_WORKER_SECRET="..." \
  COLLECTOOLS_URL="https://www.collectools.app"

# Optional residential proxy (recommended)
# fly secrets set PROXY_SERVER="http://user:pass@host:port"

fly deploy --config scripts/queue-watch-worker/fly.toml
```

## Step 6 — Upload cookie profile to Fly volume

After bootstrap locally:

```bash
fly ssh sftp shell
put -r scripts/queue-watch-worker/pc-profile /data/pc-profile
```

Or from repo root if profile is there:

```bash
cd scripts/queue-watch-worker
fly ssh sftp shell
put -r pc-profile /data/pc-profile
```

## Step 7 — Verify logs during drop window

```bash
fly logs
```

Healthy output:

```text
scan {"live":false,"challenge":false,"confidence":0,...}
```

On drop:

```text
scan {"live":false,"challenge":true,"signals":["imperva-human-verify"],...}
report {"ok":true,"status":200,...}
```

## Step 8 — Pro users

Users only need **Phone alerts** enabled on `/pokewatch`. No app or bookmarklet required.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `403` on report | `QUEUE_WATCH_WORKER_SECRET` mismatch between Fly and Vercel |
| `40+ blocked polls` in logs | Re-bootstrap cookies; add `PROXY_SERVER` |
| No push | Check `push_alert_dedupe` in Supabase; confirm VAPID env |
| Worker idle all day | Only runs Mon–Fri 10am–3pm ET; use `FORCE_DROP_WINDOW=1` to test |

## Supabase checks

```sql
select alert_key, sent_at from push_alert_dedupe
where alert_key in ('imperva_challenge_global', 'queue_live_global')
order by sent_at desc limit 5;

select session_id, live, signals, reported_at
from queue_watch_reports
where session_id like 'remote-monitor%'
order by reported_at desc limit 5;
```
