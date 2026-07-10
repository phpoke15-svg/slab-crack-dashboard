# CollecTools — public deploy checklist

Use this before marketing the site as public.

## 1. Database (Supabase SQL Editor)

1. Prefer one-shot: paste and run [`supabase/pokematch-setup.sql`](./supabase/pokematch-setup.sql).
2. If the binder banner only lists **Binder card numbers** + **Price cache**, run the smaller patch instead: [`supabase/pokematch-missing-pieces.sql`](./supabase/pokematch-missing-pieces.sql).
3. For SlabCrack catalog/arbitrage tables (if empty): run [`supabase/schema.sql`](./supabase/schema.sql), then seed/sync prices.
4. Optional: **Settings → API → Reload schema**, wait ~30s, hard-refresh `/binder`. The amber setup banner must be gone.
5. Restocks board: run [`supabase/restocks.sql`](./supabase/restocks.sql). Walmart SKUs auto-discover after Affiliate API keys are set.

## 2. One Vercel project

This repo has historically deployed to **two** projects (`slabcrack` and `slab-crack-dashboard`).

1. In Vercel, open both projects → **Settings → Git**.
2. Keep **one** production project (recommend the one serving `slab-crack-dashboard.vercel.app` or your custom domain).
3. On the other: disconnect the Git repo **or** disable Production deployments so env/crons cannot diverge.
4. Confirm Production domain points at the kept project.

## 3. Environment variables (Production)

Copy from [`.env.example`](./.env.example). Minimum for public:

| Variable | Why |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Auth + data |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Matching, crons, setup health |
| `CRON_SECRET` | **Required in production** — cron routes refuse to run without it |
| `PRICECHARTING_API_KEY` | Binder price cron + discovery |
| `PRICE_SOURCE` | `ebay` or `pricecharting` |
| `EBAY_SOLD_API_KEY` | If `PRICE_SOURCE=ebay` |
| `NEXT_PUBLIC_SITE_URL` | Legal pages, sitemap, auth redirects |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Privacy/Terms + report ops |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | Ads (fallback exists in code) |
| `NEXT_PUBLIC_ADSENSE_FEED_SLOT_ID` | Feed unit (fallback `7057947062`) |
| `REPORTS_DISCORD_WEBHOOK` | Optional — Discord alert on user reports |
| `POKEMON_CENTER_DISCORD_WEBHOOK` | Queue Watch alerts (also used as report fallback) |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Optional Search Console |
| `STRIPE_SECRET_KEY` | Checkout + portal (paid launch) |
| `STRIPE_WEBHOOK_SECRET` | Subscription sync webhook |
| `STRIPE_PRICE_PREMIUM_MONTHLY` / `_YEARLY` | Premium price IDs |
| `STRIPE_PRICE_PRO_MONTHLY` / `_YEARLY` | Pro price IDs |

After changing env vars, **Redeploy**.

## 4. Custom domain + Auth

1. Vercel → Project → Domains → add `collectools.app` (or your domain).
2. Set `NEXT_PUBLIC_SITE_URL=https://collectools.app` (no trailing slash).
3. Supabase → Authentication → URL configuration:
   - Site URL = `https://collectools.app`
   - Redirect allow list includes `https://collectools.app/**` and the Vercel URL if still used
4. Confirm `support@…` inbox receives mail (legal + abuse).

## Billing (Premium / Pro)

1. Run [`supabase/billing-plans.sql`](./supabase/billing-plans.sql) in Supabase.
2. Create Stripe products/prices:
   - **Premium** — $1.99/mo + $20/yr (ad-free)
   - **Pro** — $9.99/mo + $90/yr (ad-free + Queue Watch)
3. Set Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the four `STRIPE_PRICE_*` IDs.
4. Stripe webhook endpoint: `https://YOUR_HOST/api/billing/webhook` (events: `checkout.session.completed`, `customer.subscription.*`).
5. Pricing page: `/pricing`

## 5. Crons + health

`vercel.json` schedules:

- `/api/cron/discover-arbitrage` — daily 06:00 UTC
- `/api/cron/sync-binder-prices` — daily 07:00 UTC
- `/api/cron/sync-restocks` — every 15 minutes (Walmart Affiliate SKUs)
- `/api/cron/walmart-wednesday-reminder` — Thu 01:00 & 02:00 UTC (Wed 9pm ET DST/STD); Discord ping

## Restocks (Walmart auto-discovery)

1. Run [`supabase/restocks.sql`](./supabase/restocks.sql) (creates tables).
2. Set Walmart Affiliate env: `WALMART_AFFILIATE_CONSUMER_ID`, `WALMART_AFFILIATE_PRIVATE_KEY`, `WALMART_AFFILIATE_PUBLISHER_ID`.
3. Cron `/api/cron/sync-restocks` every 15m:
   - **Discovers** sealed Pokémon TCG SKUs via Affiliate search (no manual item list required)
   - **Checks** stock and can Discord-alert on restock (`RESTOCKS_DISCORD_WEBHOOK`)
4. Optional: `WALMART_DISCOVERY_QUERIES` (pipe-separated search strings).
5. UI: `/restocks`
6. **Pokémon Center** live queues stay on **Queue Watch** (`/queue-watch`) — not this board.

Uptime / config probe (no auth):

```bash
curl "https://YOUR_HOST/api/health"
```

Smoke-test crons (replace secret + host):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://YOUR_HOST/api/cron/discover-arbitrage"
curl -H "Authorization: Bearer $CRON_SECRET" "https://YOUR_HOST/api/cron/sync-binder-prices"
curl -H "Authorization: Bearer $CRON_SECRET" "https://YOUR_HOST/api/cron/sync-restocks"
curl -H "Authorization: Bearer $CRON_SECRET" "https://YOUR_HOST/api/cron/walmart-wednesday-reminder?force=1"
```

## 6. Product smoke test

- [ ] Sign up / sign in
- [ ] SlabCrack feed loads; first ad after 5th card (not above the fold)
- [ ] PokeMatch: add card, friend request, start trade
- [ ] Block / report another profile
- [ ] `/privacy` and `/terms` load; footer links work
- [ ] Setup banner absent on `/binder`
- [ ] `/pricing` loads; Choose Premium / Choose Pro when Stripe is configured
- [ ] Test-mode checkout (card `4242…`); Premium hides ads; Pro unlocks Queue Watch

## 7. Ads

- AdSense site approved for the live domain
- `ads.txt` at `https://YOUR_HOST/ads.txt`
- Expect blank units until Google fills inventory

## 8. Deploy reliability

- `package-lock.json` must include `vitest` (and match `package.json`)
- Prefer `installCommand: "npm ci"` in `vercel.json` once the lockfile is healthy
