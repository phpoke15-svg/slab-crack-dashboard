# Store launch checklist (Play + App Store)

Privacy policy (live): https://slab-crack-dashboard.vercel.app/privacy  
Package / bundle ID: `com.collectools.app`  
Version: **1.2.0** (Android `versionCode` 3)

## Done in repo

- [x] App icons / splash / notification assets under `apps/pc-queue-watch/assets/`
- [x] `privacyPolicyUrl` in `app.json`
- [x] Privacy policy covers native Queue Watch + WebView
- [x] EAS `production` profiles for Android AAB + iOS
- [x] Mobile Queue Watch can sync to web when you open CollecTools in-app while Pro (copies bookmarklet token)
- [x] Restocks hidden until Walmart Affiliate returns
- [x] Web launch: Stripe, SoldComps, EPN campaign links, Queue Watch SQL, web push

## You + agent together (needs your accounts)

### 1. Vercel hygiene (5 min)
- Disconnect or disable Production on duplicate project **`slabcrack`**
- Keep **`slab-crack-dashboard`** only

### 2. Expo / EAS (10 min)
```bash
cd apps/pc-queue-watch
npm install
npx eas-cli login
npx eas-cli build -p android --profile apk          # internal test APK
npx eas-cli build -p android --profile production   # Play AAB
npx eas-cli build -p ios --profile production       # needs Apple team
```

### 3. Google Play Console
- Create app `com.collectools.app`
- Upload AAB from EAS
- Store listing, screenshots (phone), content rating, **Data safety**
- Privacy policy URL: `https://slab-crack-dashboard.vercel.app/privacy`
- Decide billing: Stripe in WebView vs Play Billing (Google is strict on IAP)
- Internal testing track first

### 4. Apple Developer + App Store Connect
- Enroll ($99/yr) if not already
- Create app with bundle `com.collectools.app`
- Replace `ascAppId` in `eas.json` → `submit.production.ios`
- Privacy Nutrition Labels (account, purchase, diagnostics, notifications)
- Screenshots + review notes: “WebView of CollecTools + Pokémon Center for queue monitoring; local alerts”
- TestFlight before release

### 5. Optional later
- FCM / APNs remote push (today: **local** notifications while monitoring)
- Custom domain instead of `*.vercel.app`
- Re-enable Restocks when Walmart Affiliate keys work

## Smoke before store submit

1. Web: sign-in, Premium/Pro trial, SlabCrack, Queue Watch bookmarklet **active · synced**
2. APK: CollecTools tab loads site; Queue tab monitors; notification on test live signal
3. Open `/queue-watch` on phone WebView while Pro so token bridges to native sync
