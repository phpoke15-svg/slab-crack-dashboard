# Store launch checklist (Play + App Store)

Privacy policy (live): https://collectools.app/privacy  
Package / bundle ID: `com.collectools.app`  
Version: **1.3.5** (Android `versionCode` 10). EAS slug is `pokepax` (legacy project id); app display name stays **CollecTools**. Brand: dark `#0b0e14` + mint `#4ade80` (white C / mint T icons).

## Done in repo

- [x] App icons / splash / notification assets under `apps/pc-queue-watch/assets/`
- [x] `privacyPolicyUrl` in `app.json`
- [x] Privacy policy covers native PokeWatch + WebView
- [x] EAS `production` profiles for Android AAB + iOS
- [x] Mobile PokeWatch can sync to web when you open CollecTools in-app while Pro (copies bookmarklet token)
- [x] Restocks hidden until Walmart Affiliate returns
- [x] Web launch: Stripe, SoldComps, EPN campaign links, PokeWatch SQL, web push

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
- Privacy policy URL: `https://collectools.app/privacy`
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

1. Web: sign-in, Premium/Pro trial, SlabCrack, PokeWatch bookmarklet **active · synced**
2. APK: site loads full-screen; from `/pokewatch` open native PokeWatch; notification on test live signal
3. Open `/pokewatch` in-app while Pro so token bridges to native sync
