# AGENTS.md

## Cursor Cloud specific instructions

CollecTools is a Next.js 16 (App Router, React 19, Turbopack) Pokémon TCG collector web app. It is a small monorepo; the root is the main web app. Two optional satellite packages exist: `live-binder-hud` (standalone Express dev server) and `apps/pc-queue-watch` (Expo/React Native mobile app). Neither is needed to run or test the core web app.

Node `>=22.12` and npm are required (already installed on the VM). Dependencies are installed by the update script (`npm ci`).

### Services

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Web app (dev) | `npm run dev` | 3000 | Next.js dev server; core UI + API routes. Reads env from process env and `.env.local`. |
| Live Binder HUD (optional) | `npm run live-binder-hud` | 8787 | Standalone; production uses the Next.js `/api/live-binder-hud/*` routes instead. |

### Lint / test / build

- Test: `npm run test` (Vitest; `lib/**/*.test.ts`). No running services required.
- Lint: `npm run lint` is a placeholder (`echo` only) — there is no ESLint config; `npm run test` is the real check.
- Build: `npm run build`. Note `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so a green build does NOT imply type-clean code — rely on `npm test`.

### Environment / secrets (non-obvious)

- Secrets are injected as environment variables. Next.js does NOT override already-set process env vars with `.env.local`, so injected secrets win. Keep non-secret local defaults (e.g. `PRICE_SOURCE`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`) in a gitignored `.env.local`; it is not committed (`.env*` is gitignored).
- The Supabase instance configured via the injected `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `DATABASE_URL` is the **live/production** project — treat writes with care and clean up any test data.
- The PokeMatch/SlabCrack schema is already applied on that Supabase project (verify via `curl -s localhost:3000/api/health` → `pokematchReady: true`). SQL setup files under `supabase/` do NOT need to be re-run.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is currently NOT provided. Without it, server-side/admin paths (service role) still work, but browser auth (sign-in/sign-up) and public anon-key read pages break — e.g. `/card-lounge` returns 500. Add this secret to exercise full UI auth flows.
- Health check with no auth: `curl -s localhost:3000/api/health` reports which integrations are configured (`stripeConfigured`, `webPushConfigured`, etc.). Most external integrations (Stripe, price APIs, web push, Walmart, Gemini/OpenAI) are optional and unset by default; their features degrade gracefully.
- `middleware.ts` logs a deprecation warning ("use proxy instead") on Next 16 — this is expected and harmless.
