# CollecTools Mobile App

Installable **Android / iOS** app (v1.2.0) that loads your live **CollecTools website** plus a native **Queue Watch** that survives Imperva.

Store path: see **[STORE.md](./STORE.md)**.

## CollecTools tab (default)

Opens the full website inside the app:

- Hub with SlabCrack, PokeMatch, and Queue Watch
- Sign in, binder, trades, messages — everything on the site
- In-app navigation stays on your CollecTools domain; external links open in the browser
- If you open Queue Watch while Pro, the app copies your monitor token so native Queue can sync to the website

## Queue tab (primary for drops)

**WebView-first monitoring** (not a headless fetch from the phone IP):

1. Tap **Start monitoring** — Pokemon Center loads **in the app**
2. Pass any Imperva / bot check in that page (once)
3. Leave the Queue tab open — injected JS watches Queue-it like the desktop bookmarklet
4. Get a **local push** when the virtual queue goes live
5. Status can sync to `/queue-watch` on the website when a Pro token was bridged from the CollecTools tab

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
