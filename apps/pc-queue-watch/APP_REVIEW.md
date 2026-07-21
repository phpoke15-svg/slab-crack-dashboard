# App Store resubmission checklist (CollecTools iOS)

Bundle ID: `com.collectools.app`  
App Store Connect ID: `6790246131`

## Rejection fixes

### 2.3.10 — Remove Google Play references (in-app)

**Code (deploy web + new iOS build):**
- WebView injects `html.native-app`; CSS hides `.app-store-badge--android`, `.android-only-copy`, `.mobile-store-badges`
- Android setup copy on PokeWatch is hidden in the native shell

**App Store Connect metadata (manual):**
- Remove “Google Play”, “Android”, or Play Store badges from screenshots, description, and promotional text if present

---

### 3.1.1 — In-App Purchase (blocking)

Apple requires Premium/Pro subscriptions to be sold with **StoreKit**, not Stripe, inside the iOS app.

**Before resubmitting you must:**

1. **App Store Connect → Subscriptions**
   - Create subscription group (e.g. `collectools_plans`)
   - Add products matching web tiers, for example:
     - `collectools_premium_monthly` — Premium $4.99/mo
     - `collectools_premium_yearly` — Premium $39.99/yr
     - `collectools_pro_monthly` — Pro $9.99/mo
     - `collectools_pro_yearly` — Pro $99.99/yr
   - Enable 7-day free trial on each (matches web)

2. **Native app**
   - Add `react-native-iap` (or RevenueCat) to `apps/pc-queue-watch`
   - Handle WebView message `{ type: "collectools-iap-purchase", priceKey }` in `SiteWebScreen.tsx`
   - Present StoreKit purchase sheet and validate receipt server-side

3. **Server**
   - Add `/api/billing/apple/verify` to sync App Store subscriptions to Supabase entitlements (mirror Stripe webhook flow)

4. **Web (already started)**
   - Stripe checkout blocked when `html.native-app` is present
   - Stripe URLs blocked in WebView navigation

**Do not resubmit until IAP purchase works end-to-end on TestFlight.**

---

### 5.1.2(i) — Tracking / ATT

**We do not track users across apps for advertising.**

**App Store Connect (manual — Account Holder):**
1. App Privacy → **Data Used to Track You** → set to **No** / remove tracking purposes
2. Keep “Data Linked to You” only for app functionality (account email, photos for scan, etc.)

**Code:**
- Removed unused `NSUserTrackingUsageDescription` from `app.json`
- Disabled Vercel Analytics + AdSense inside the native WebView (`components/web-extras.tsx`)

**No ATT prompt needed** if privacy labels no longer declare tracking.

---

### 2.1(a) — Demo account for App Review

**App Store Connect → App Review Information:**

| Field | Value |
|-------|--------|
| Username | *(create a dedicated reviewer account)* |
| Password | *(strong password)* |

**Setup steps:**
1. Create `reviewer@yourdomain.com` (or similar) in Supabase Auth
2. Grant **Pro** entitlements in DB or via a comp Stripe subscription for review only
3. In Review Notes, paste:

```
CollecTools is a WebView of https://www.collectools.app with native PokeWatch queue monitoring.

Sign in with the demo account above (Pro plan pre-enabled).

To test PokeWatch:
1. Open app → sign in
2. Hub → PokeWatch
3. Tap "Open native PokeWatch" for Imperva-safe monitoring + local alerts

To test subscriptions (after IAP build):
Pricing → tap Premium or Pro → Apple In-App Purchase sheet

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

Bump `ios.buildNumber` in `app.json` each submission (currently **27**).

---

## Suggested reply to App Review (paste in Resolution Center)

> **2.3.10:** We removed Google Play badges and Android-only setup copy from the in-app WebView experience. App metadata will be updated to remove third-party store references.
>
> **3.1.1:** We implemented Apple In-App Purchase for Premium and Pro subscriptions in the iOS app. External Stripe checkout is disabled in the native shell. Subscriptions are available on the Pricing screen via StoreKit.
>
> **5.1.2:** We updated App Privacy labels to reflect that we do not track users. We removed the unused App Tracking Transparency string and disabled third-party analytics/ads in the native WebView.
>
> **2.1:** Demo credentials are provided in App Review Information. The account has Pro access for testing PokeWatch and native queue monitoring.

*(Only send the 3.1.1 paragraph after IAP is actually working on TestFlight.)*
