# AGENTS.md

## Cursor Cloud specific instructions

CollecTools is a **single Next.js 16 app** (App Router, React 19, Tailwind v4, TypeScript).
There is no separate backend — API routes live under `app/api/*`. Dependencies are
installed automatically on startup (`npm ci`).

### Services

- **Web app (the only runnable service):** `npm run dev` → Next.js dev server on
  `http://localhost:3000` (Turbopack). This is the whole product.
- `apps/pc-queue-watch` is an **optional** Expo/React Native wrapper (its own
  `package.json`); it just loads the live site in a WebView and is not needed to develop
  or test the web product.

### Standard commands

Use the scripts in `package.json`:
- `npm run dev` — dev server (development mode).
- `npm run build` / `npm start` — production build/serve.
- `npm test` — Vitest unit tests (`lib/**/*.test.ts`).
- `npm run lint` — **no-op** (prints a message; there is no ESLint config). Use `npm test`
  for checks.

### Running without secrets (important gotcha)

The app is designed to **degrade gracefully with zero secrets configured**, so
`npm run dev` renders fine out of the box:
- All external clients (Supabase, Stripe, Gemini/OpenAI) are created lazily and only throw
  when actually invoked; `middleware.ts` and provider components short-circuit when their
  env vars are missing. Static/marketing pages and every tool page *shell* render.
- `GET /api/health` returns **HTTP 503** with all checks `false` when unconfigured — this
  is expected, not a failure.
- Data-driven flows (sign-in, binder/PokeMatch, CardLounge feed, Stripe checkout, camera
  card scan, live pricing) require their respective secrets. To exercise them, copy
  `.env.example` to `.env.local` and fill in at minimum Supabase keys (then run the SQL in
  `supabase/*.sql` against your project). See `.env.example` and `DEPLOY.md` for the full
  list of which var gates which feature.
