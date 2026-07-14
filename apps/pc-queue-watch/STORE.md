# Store launch checklist (Play + App Store)

Privacy policy (live): https://collectools.app/privacy  
Package / bundle ID: `com.collectools.app`  
Version: **1.3.10** (Android `versionCode` 15, iOS `buildNumber` 15). EAS slug is `pokepax` (legacy project id); app display name stays **CollecTools**. Brand: dark `#0b0e14` + mint `#4ade80` (white C / mint T icons matching the website header mark). WebView loads `https://www.collectools.app` (apex redirects there).

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

**Start in the cloned repo root** (`…/slab-crack-dashboard`), not `~`. Confirm with `ls apps/pc-queue-watch/app.json`.

EAS **must** see `apps/pc-queue-watch` (where `app.json` / `eas.json` live). Prefer the root `mobile:*` scripts — they call `scripts/run-eas.mjs`, which forces that directory on Windows/macOS/Linux and avoids `Run this command inside a project directory.` A Node `punycode` deprecation line from `eas-cli` is harmless and is suppressed by the runner.

```bash
cd ~/slab-crack-dashboard   # or wherever you cloned it
git fetch origin && git checkout cursor/fix-eas-submit-punycode-6a73   # until merged

npm run mobile:install
npx --prefix apps/pc-queue-watch eas-cli login
npm run mobile:build:apk          # internal test APK
npm run mobile:build:android      # Play AAB
npm run mobile:build:ios          # needs Apple team
npm run mobile:submit:android     # Play (internal/draft track, --latest)
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
