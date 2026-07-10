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

**Hobby cron limit:** Vercel Hobby only allows cron schedules that run **once per day**. More frequent expressions (e.g. `*/15 * * * *`) fail the entire deployment. Keep `vercel.json` crons daily on Hobby, or upgrade to Pro for frequent restock polling.

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
   - **Premium** — $4.99/mo + $39.99/yr (full SlabCrack + ad-free)
   - **Pro** — $9.99/mo + $99.99/yr (everything, including Queue Watch)
3. Set Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the four `STRIPE_PRICE_*` IDs.
4. Stripe webhook endpoint: `https://YOUR_HOST/api/billing/webhook` (events: `checkout.session.completed`, `customer.subscription.*`).
5. Pricing page: `/pricing`

## 5. Crons + health

`vercel.json` schedules:

- `/api/cron/discover-arbitrage` — daily 06:00 UTC
- `/api/cron/sync-binder-prices` — daily 07:00 UTC
- `/api/cron/sync-restocks` — daily 08:00 UTC on Hobby (Vercel Hobby allows only once/day crons; upgrade to Pro for `*/15`)
- `/api/cron/walmart-wednesday-reminder` — Thu 01:00 UTC (Wed 9pm ET during EDT); Web Push + optional Discord

## Web Push (phone alerts)

1. Run [`supabase/web-push.sql`](./supabase/web-push.sql).
2. Generate VAPID keys: `npx web-push generate-vapid-keys`
3. Set Vercel env:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (e.g. `mailto:support@collectools.app`)
4. Redeploy. Users enable **Phone alerts** on `/queue-watch` or `/restocks`.
5. Sends:
   - Pokémon Center queue live → **all Pro members** who enabled queue phone alerts (one monitor detects → everyone notified)
   - Walmart Wednesday 9pm ET reminder (anyone who opted in)
6. **iOS:** Add to Home Screen first, then enable alerts from the home-screen icon.

## Restocks (Walmart auto-discovery)

1. Run [`supabase/restocks.sql`](./supabase/restocks.sql) (creates tables).
2. Set Walmart Affiliate env: `WALMART_AFFILIATE_CONSUMER_ID`, `WALMART_AFFILIATE_PRIVATE_KEY`, `WALMART_AFFILIATE_PUBLISHER_ID`.
3. Cron `/api/cron/sync-restocks` daily (Hobby once/day limit; Pro can use `*/15`):
   - **Discovers** sealed Pokémon TCG SKUs via Affiliate search (no manual item list required)
   - **Checks** stock and can Discord-alert on restock (`RESTOCKS_DISCORD_WEBHOOK`)
4. Optional: `WALMART_DISCOVERY_QUERIES` (pipe-separated search strings).
5. UI: `/restocks`
6. **Pokémon Center** live queues stay on **Queue Watch** (`/queue-watch`) — not this board.
7. Set `RESTOCKS_REPORT_SECRET` in production so `/api/restocks/report` is not open.

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
- [ ] `/pricing` loads; Start Premium/Pro trial when Stripe is configured
- [ ] Live-mode checkout; Premium hides ads; Pro unlocks Queue Watch
- [ ] `/api/health` shows `ok: true` and `launchReady.billing: true`
- [ ] Phone alerts: VAPID env set (`launchReady.phoneAlerts: true`) and opt-in works on `/queue-watch`
- [ ] Restocks: Walmart Affiliate env set if you want auto-discovery (`launchReady.restocksWalmart`)
- [ ] Only one Vercel project deploys Production for this domain

## 7. Ads

- AdSense site approved for the live domain
- `ads.txt` at `https://YOUR_HOST/ads.txt`
- Expect blank units until Google fills inventory

## 8. Deploy reliability

- `package-lock.json` must include `vitest` (and match `package.json`)
- Prefer `installCommand: "npm install"` (or keep lockfile in sync with `npm ci`)
- After adding deps locally, commit an updated `package-lock.json` when possible
