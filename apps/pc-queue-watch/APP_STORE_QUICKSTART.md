# App Store setup — quick start (no iPhone required)

One checklist for IAP, review login, and subscription screenshots.

## 1. Database (once)

Supabase → **SQL Editor** → paste and run:

`supabase/app-store-launch.sql`

## 2. Server setup (one curl)

Replace `YOUR_CRON_SECRET` with the value from Vercel → Settings → Environment Variables:

```bash
curl -sS -X POST "https://www.collectools.app/api/admin/app-store-setup" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" | jq
```

This creates the review account and returns a **ready / not ready** checklist plus copy-paste fields.

Check anytime (no changes):

```bash
curl -sS "https://www.collectools.app/api/admin/app-store-setup" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" | jq
```

## 3. Vercel env (once)

Add from App Store Connect → **Users and Access** → **Keys**:

| Variable | What |
|----------|------|
| `APPLE_IAP_KEY_ID` | Key ID |
| `APPLE_IAP_ISSUER_ID` | Issuer ID |
| `APPLE_IAP_PRIVATE_KEY` | `.p8` file contents |
| `APPLE_IAP_BUNDLE_ID` | `com.collectools.app` (optional) |

Redeploy after saving.

## 4. App Store Connect subscriptions

Create **one group**, then **4 products** (IDs must match exactly):

| Product ID | Price |
|------------|-------|
| `collectools_premium_monthly` | $4.99/mo |
| `collectools_premium_yearly` | $39.99/yr |
| `collectools_pro_monthly` | $9.99/mo |
| `collectools_pro_yearly` | $99.99/yr |

Add **7-day free trial** on each.

**Review screenshot** (no iPhone):

| Product | Upload this file |
|---------|------------------|
| Premium (monthly + yearly) | `store-assets/iap-review/collectools-premium-plan.png` |
| Pro (monthly + yearly) | `store-assets/iap-review/collectools-pro-plan.png` |

Regenerate screenshots:

```bash
npm run capture:iap-screenshots
```

## 5. Review login (paste into App Store Connect)

| Field | Value |
|-------|--------|
| Email | `appreview@collectools.app` |
| Password | `CollectoolsReview2026!` |

(Full review notes are in the `reviewNotes` field from step 2’s curl response.)

## 6. iOS build

```bash
cd apps/pc-queue-watch
npm install
npx eas-cli build -p ios --profile production
npx eas-cli submit -p ios --profile production
```

---

When step 2 returns `"ready": true`, you’re set to submit after the Connect subscriptions and iOS build are done.
