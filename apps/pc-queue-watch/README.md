# CollecTools Mobile App

Installable **Android APK** (v1.1.0) that loads your live **CollecTools website** plus a native **Queue Watch** that survives Imperva.

## CollecTools tab (default)

Opens the full website inside the app:

- Hub with SlabCrack, PokeMatch, and Queue Watch
- Sign in, binder, trades, messages — everything on the site
- In-app navigation stays on your CollecTools domain; external links open in the browser

## Queue tab (primary for drops)

**WebView-first monitoring** (not a headless fetch from the phone IP):

1. Tap **Start monitoring** — Pokemon Center loads **in the app**
2. Pass any Imperva / bot check in that page (once)
3. Leave the Queue tab open — injected JS watches Queue-it like the desktop bookmarklet
4. Get a **local push** when the virtual queue goes live

Headless `fetch` is only a weak fallback if the WebView stops heartbeating (e.g. app fully backgrounded). For reliable alerts, keep the Queue tab open (screen can dim; keep-awake is enabled while monitoring).

## Build the APK

```bash
cd apps/pc-queue-watch
npm install
# optional: regenerate placeholder icons if assets/ is missing
# python scripts/generate-assets.py
npx eas-cli login
npm run build:apk
```

This ships **version 1.1.0** (`versionCode` 2) with WebView-first Queue Watch. Uninstall the old APK first only if Android refuses the upgrade.

## Dev preview

```bash
npm start
```

Use Expo Go to test UI. **Verify push + WebView monitoring on a real APK** — Expo Go has limitations.

## Optional env

Create `.env`:

```
EXPO_PUBLIC_COLLECTOOLS_URL=https://slab-crack-dashboard.vercel.app
```

Point this at your production URL if it differs from the default.
