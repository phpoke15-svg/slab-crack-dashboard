# Production launch — status

Live health (until domain DNS flips): `https://slab-crack-dashboard.vercel.app/api/health`  
Custom domain (target): `https://collectools.app`

## Green (on Vercel production)

- Supabase + PokeMatch + Queue Watch reports + Web Push tables
- Stripe billing (`stripeConfigured`)
- SoldComps eBay sold comps
- EPN Campaign ID on SlabCrack eBay links
- Phone alerts / restock report secret configured
- Deal Intelligence tables present (`slab_price_snapshots`; charts fill after daily sync)
- Restocks **hidden** (`RESTOCKS_ENABLED=false`) until Walmart Affiliate is ready
- Code defaults / mobile config pointed at `collectools.app`

## Blocked on you (cannot do from repo)

1. **DNS for collectools.app** — still Squarespace “Coming Soon” (`nsb*.squarespacedns.com`). Point `@` A → `76.76.21.21` and `www` CNAME → `cname.vercel-dns.com`, **or** switch nameservers to Vercel. Wait for Vercel Domains = Valid.
2. **Vercel Production env** — set `NEXT_PUBLIC_SITE_URL=https://collectools.app`, then Redeploy.
3. **Supabase Auth URLs** — Site URL `https://collectools.app`; redirect allow list `https://collectools.app/**` (+ keep Vercel URL temporarily).
4. **Stripe webhook** — endpoint `https://collectools.app/api/billing/webhook`.
5. **One Vercel project** — disconnect Production on duplicate **`slabcrack`**.
6. **Smoke test** on the new domain after DNS works.
7. **Rebuild APK** so the app WebView uses `collectools.app`.

## Intentionally deferred

- Walmart Affiliate Restocks auto-discovery
- Remote FCM/APNs push (native app uses local notifications for now)
- **Display ads** — hidden until AdSense is approved for `collectools.app` (`NEXT_PUBLIC_ADS_ENABLED=true` to turn on)
- Escrow / built-in shipping
