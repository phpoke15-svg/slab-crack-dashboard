# Production launch — status

Live health: `https://slab-crack-dashboard.vercel.app/api/health`

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

## Intentionally deferred

- Walmart Affiliate Restocks auto-discovery
- Custom domain
- Remote FCM/APNs push (native app uses local notifications for now)
