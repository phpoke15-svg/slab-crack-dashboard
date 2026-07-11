# Production launch — status

Live health: `https://collectools.app/api/health`

## Green

- Supabase + PokeMatch + Queue Watch reports + Web Push tables
- Stripe billing (`stripeConfigured`)
- AdSense
- SoldComps eBay sold comps
- EPN Campaign ID on SlabCrack eBay links
- Phone alerts / restock report secret configured
- Restocks **hidden** (`RESTOCKS_ENABLED=false`) until Walmart Affiliate is ready

## Still manual

1. **One Vercel project** — disconnect Production on duplicate **`slabcrack`**.
2. **Smoke test** — sign-in, trial, SlabCrack, Queue Watch bookmarklet synced.
3. **Mobile stores** — see [`apps/pc-queue-watch/STORE.md`](./apps/pc-queue-watch/STORE.md).
4. **Deal Intelligence SQL** — run [`supabase/deal-intelligence.sql`](./supabase/deal-intelligence.sql) in Supabase (sample counts + deficit snapshots). Daily `/api/cron/sync-prices` is scheduled in `vercel.json`.

## Intentionally deferred

- Walmart Affiliate Restocks auto-discovery
- Custom domain
- Remote FCM/APNs push (native app uses local notifications for now)
- **Display ads** — hidden until AdSense is approved (`NEXT_PUBLIC_ADS_ENABLED=true` to turn on)
