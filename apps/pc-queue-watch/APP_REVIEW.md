# App Store resubmission checklist (CollecTools iOS)

Bundle ID: `com.collectools.app`  
App Store Connect ID: `6790246131`  
App version: **1.4.6** (iOS build **29**)

## Rejection fixes

### 2.3.10 — Remove Google Play references (in-app)

**Code (deploy web + new iOS build):**
- WebView injects `html.native-app`; CSS hides `.app-store-badge--android`, `.android-only-copy`, `.mobile-store-badges`
- Android setup copy on PokeWatch is hidden in the native shell

**App Store Connect metadata (manual):**
- Remove “Google Play”, “Android”, or Play Store badges from screenshots, description, and promotional text if present

---

### 3.1.1 — In-App Purchase (implemented)

Apple requires Premium/Pro subscriptions to be sold with **StoreKit**, not Stripe, inside the iOS app.

**App Store Connect → Subscriptions (manual — create before TestFlight):**

| Web price key | App Store product ID | Price |
|---------------|----------------------|-------|
| `premium_month` | `collectools_premium_monthly` | $4.99/mo |
| `premium_year` | `collectools_premium_yearly` | $39.99/yr |
| `pro_month` | `collectools_pro_monthly` | $9.99/mo |
| `pro_year` | `collectools_pro_yearly` | $99.99/yr |

- Subscription group: e.g. `collectools_plans`
- Enable **7-day free trial** on each (matches web Stripe trial)
- Supreme is **not** sold via IAP (email allowlist only, same as web)

**Native app (implemented):**
- `react-native-iap` in `apps/pc-queue-watch`
- WebView `{ type: "collectools-iap-purchase", priceKey }` → StoreKit sheet
- `{ type: "collectools-iap-restore" }` → restore + server sync
- `{ type: "collectools-manage-subscriptions" }` → Apple subscriptions page
- Stripe URLs blocked in WebView

**Server (implemented):**
- `POST /api/billing/apple/verify` — validate transaction + sync entitlements
- `POST /api/billing/apple/restore` — re-verify restored purchases
- `supabase/apple-iap.sql` — Apple columns on `subscriptions`

**Vercel env (required for production verify):**

| Variable | Source |
|----------|--------|
| `APPLE_IAP_KEY_ID` | App Store Connect → Users and Access → Keys |
| `APPLE_IAP_ISSUER_ID` | Same page (Issuer ID) |
| `APPLE_IAP_PRIVATE_KEY` | `.p8` key contents (use `\n` for newlines in Vercel) |
| `APPLE_IAP_BUNDLE_ID` | `com.collectools.app` (optional, defaults to this) |

Dev-only: `APPLE_IAP_SKIP_VERIFY=1` skips Apple API (local testing only — **never in production**).

**Supabase:** run `supabase/apple-iap.sql` in SQL Editor.

**Test on TestFlight:**
1. Sign in with a test account
2. Pricing → tap Pro or Premium → complete Apple purchase sheet
3. Entitlements should update to `pro` or `premium` within a few seconds
4. PokeWatch queue alerts should unlock for Pro

---

### 5.1.2(i) — Tracking / ATT

**We do not track users across apps for advertising.**

**App Store Connect (manual — Account Holder):**
1. App Privacy → **Data Used to Track You** → set to **No**
2. Keep “Data Linked to You” only for app functionality (account email, photos for scan, etc.)

**Code:**
- Removed unused `NSUserTrackingUsageDescription` from `app.json`
- Disabled Vercel Analytics + AdSense inside the native WebView (`components/web-extras.tsx`)

**No ATT prompt needed** if privacy labels no longer declare tracking.

---

### 2.1(a) — Demo account for App Review

**Shared login for Apple App Store and Google Play review** (same account):

| Field | Value |
|-------|--------|
| **Email** | `appreview@collectools.app` |
| **Password** | `CollectoolsReview2026!` (override with Vercel env `STORE_REVIEWER_PASSWORD`) |

**Setup (after deploy):**

```bash
curl -sS -X POST "https://www.collectools.app/api/admin/setup-store-reviewer" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Or run `supabase/grant-store-reviewer-pro.sql` after creating the auth user manually.

**App Store Connect → App Review Information:** paste the email + password above.

**Setup steps:**
1. Deploy latest `main`, then call `/api/admin/setup-store-reviewer` once (creates user + Pro comp subscription)
2. Confirm sign-in at https://www.collectools.app/sign-in
3. In Review Notes, paste:

```
CollecTools is a WebView of https://www.collectools.app with native PokeWatch queue monitoring.

Sign in with the demo account above (Pro plan pre-enabled).

To test PokeWatch:
1. Open app → sign in
2. Hub → PokeWatch
3. Tap "Open native PokeWatch" for Imperva-safe monitoring + local alerts

To test subscriptions:
Pricing → tap Premium or Pro → Apple In-App Purchase sheet
Use Restore purchases if needed.

No Google Play references appear in the iOS app. Subscriptions use In-App Purchase only.
```

---

## Build & submit

```bash
cd apps/pc-queue-watch
npm install
npx eas-cli build -p ios --profile production
npx eas-cli submit -p ios --profile production
```

Bump `ios.buildNumber` in `app.json` each submission.

---

## Suggested reply to App Review (Resolution Center)

> **2.3.10:** We removed Google Play badges and Android-only setup copy from the in-app WebView experience. App metadata has been updated to remove third-party store references.
>
> **3.1.1:** We implemented Apple In-App Purchase for Premium and Pro subscriptions in the iOS app using StoreKit. External Stripe checkout is disabled in the native shell. Subscriptions are available on the Pricing screen, with Restore purchases and manage-subscription support.
>
> **5.1.2:** We updated App Privacy labels to reflect that we do not track users. We removed the unused App Tracking Transparency string and disabled third-party analytics/ads in the native WebView.
>
> **2.1:** Demo credentials are provided in App Review Information. The account has Pro access for testing PokeWatch and native queue monitoring.
