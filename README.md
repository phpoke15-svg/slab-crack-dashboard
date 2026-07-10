# CollecTools

TCG collector toolkit: **SlabCrack**, **PokeMatch**, and **Queue Watch**.

## Live

- Production: https://slab-crack-dashboard.vercel.app
- Public launch steps: [DEPLOY.md](./DEPLOY.md)

## Database

Run `supabase/pokematch-setup.sql` in the Supabase SQL Editor (or the smaller
`supabase/pokematch-missing-pieces.sql` if only card numbers / price cache are missing).

For Premium/Pro billing, also run `supabase/billing-plans.sql` and set Stripe env vars
(see [DEPLOY.md](./DEPLOY.md) § Billing).

## Local

```bash
cp .env.example .env.local
# fill Supabase + API keys (Stripe optional for local checkout)
npm ci
npm run dev
```

## Billing

- Pricing page: `/pricing`
- Plans: Free (ads) · Premium (ad-free) · Pro (ad-free + Queue Watch)
- Setup: [DEPLOY.md](./DEPLOY.md) § Billing

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run test` | Vitest unit tests |
| `npm run discover-arbitrage` | Scan for slab &lt; raw opportunities |
| `npm run sync-binder-prices` | Refresh PokeMatch price cache |
