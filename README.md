# CollecTools

TCG collector toolkit: **SlabCrack**, **Grade Check**, **PokeMatch**, and **Queue Watch**.

## Live

- Production: https://slab-crack-dashboard.vercel.app
- Public launch steps: [DEPLOY.md](./DEPLOY.md)

## Local

```bash
cp .env.example .env.local
# fill Supabase + API keys
npm ci
npm run dev
```

## Database

Run `supabase/pokematch-setup.sql` in the Supabase SQL Editor (or the smaller
`supabase/pokematch-missing-pieces.sql` if only card numbers / price cache are missing).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run test` | Vitest unit tests |
| `npm run discover-arbitrage` | Scan for slab &lt; raw opportunities |
| `npm run sync-binder-prices` | Refresh PokeMatch price cache |
