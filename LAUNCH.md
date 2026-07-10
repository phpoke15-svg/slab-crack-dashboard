# Production launch — remaining manual steps

Live health: `https://slab-crack-dashboard.vercel.app/api/health`

## Already green (from last probe)

- Supabase + PokeMatch schema
- Cron secret
- AdSense client/slot
- Stripe checkout prices configured

## Do these before marketing hard

### 1. One Vercel project

You have both `slabcrack` and `slab-crack-dashboard` on the same repo.

1. Keep **slab-crack-dashboard** (owns `slab-crack-dashboard.vercel.app`).
2. On **slabcrack**: Settings → Git → Disconnect, or disable Production deployments.
3. Confirm env vars match on the kept project.

### 2. Web Push (phone alerts) — currently off

```bash
npx web-push generate-vapid-keys
```

Add to Vercel Production env:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT=mailto:support@collectools.app`

Run `supabase/web-push.sql` in Supabase if not already. Redeploy.

### 3. Walmart Restocks — currently off

Set:

- `WALMART_AFFILIATE_CONSUMER_ID`
- `WALMART_AFFILIATE_PRIVATE_KEY`
- `WALMART_AFFILIATE_PUBLISHER_ID`

Optional: `RESTOCKS_DISCORD_WEBHOOK`, `RESTOCKS_REPORT_SECRET` (required for `/api/restocks/report` in production).

### 4. Stripe Live checklist

- Live mode keys + four Live price IDs on Vercel
- Webhook: `https://slab-crack-dashboard.vercel.app/api/billing/webhook`
- Events: `checkout.session.completed`, `customer.subscription.created/updated/deleted`
- Run `supabase/billing-plans.sql` if not done

### 5. Smoke test

- Sign in
- `/pricing` → Start Premium trial
- Free SlabCrack shows 10-card preview + upgrade CTA on search
- Pro unlocks `/queue-watch`
- `/privacy` `/terms` `/ads.txt`
