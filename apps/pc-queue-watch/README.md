# CollecTools Mobile App

Installable **Android / iOS** app (v1.3.1) that loads your live **CollecTools website** plus a native **Queue Watch** that survives Imperva. **Queue Watch is Pro-only** — sign in on the CollecTools tab, open site Queue Watch once to link your token, then Start monitoring.

Theme: dark background + **white / mint-green** accents (same as the website). Rebuild the APK after theme changes — old installs keep the previous blue UI until you install a new build.

Store path: see **[STORE.md](./STORE.md)**.

## CollecTools tab (default)

Opens the full website inside the app:

- Hub with SlabCrack, PokeMatch, and Queue Watch
- Sign in, binder, trades, messages — everything on the site
- In-app navigation stays on your CollecTools domain; external links open in the browser
- If you open Queue Watch while Pro, the app copies your monitor token so native Queue can sync to the website

## Queue tab (primary for drops · Pro only)

Without Pro, the Queue tab shows an unlock screen (no Pokemon Center WebView, no local alerts).

**WebView-first monitoring** (not a headless fetch from the phone IP):

1. Sign in as Pro on the CollecTools tab and open `/queue-watch` once (bridges token)
2. Tap **Start monitoring** — Pokemon Center loads **in the app**
3. Pass any Imperva / bot check in that page (once)
4. Leave the Queue tab open — injected JS watches Queue-it like the desktop bookmarklet
5. Get a **local push** when the virtual queue goes live
6. Status syncs to `/queue-watch` on the website via the Pro token

## Build internal APK

```bash
cd apps/pc-queue-watch
npm install
npx eas-cli login
npm run build:apk
```

Production store binaries:

```bash
npm run build:android   # AAB for Play
npm run build:ios       # IPA for App Store / TestFlight (Apple team required)
```

## Dev preview

```bash
npm start
```

Use Expo Go for UI. **Verify push + WebView monitoring on a real APK.**

## Env

```
EXPO_PUBLIC_COLLECTOOLS_URL=https://slab-crack-dashboard.vercel.app
```
