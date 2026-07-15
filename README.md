# CollecTools

TCG collector toolkit: **SlabCrack**, **Restocks**, **PokeMatch**, and **Queue Watch**.

## Live

- Production: https://collectools.app
- Public launch steps: [DEPLOY.md](./DEPLOY.md)

## Database

Run `supabase/pokematch-setup.sql` in the Supabase SQL Editor (or the smaller
`supabase/pokematch-missing-pieces.sql` if only card numbers / price cache are missing).

For Premium/Pro billing, also run `supabase/billing-plans.sql` and set Stripe env vars
(see [DEPLOY.md](./DEPLOY.md) § Billing).

For the Restocks board, run `supabase/restocks.sql` and configure Walmart Affiliate env vars
(see [DEPLOY.md](./DEPLOY.md) § Restocks).

## Local

```bash
cp .env.example .env.local
# fill Supabase + API keys (Stripe optional for local checkout)
npm ci
npm run dev
```

## Billing

- Pricing page: `/pricing`
- Plans: Free (10 mid-ranked SlabCrack + SlabLab cards + ads) · Premium $4.99/mo (top 100 boards, ad-free) · Pro $9.99/mo (full feeds, scanner, search, PokeWatch)
- Setup: [DEPLOY.md](./DEPLOY.md) § Billing

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run test` | Vitest unit tests |
| `npm run discover-arbitrage` | Scan for slab &lt; raw opportunities |
| `npm run sync-binder-prices` | Refresh PokeMatch price cache |
