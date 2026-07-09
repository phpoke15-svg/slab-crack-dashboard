# CollecTools Mobile App

Installable **Android APK** that loads your live **CollecTools website** — same hub, tools, and PokeMatch experience as [slab-crack-dashboard.vercel.app](https://slab-crack-dashboard.vercel.app).

## CollecTools tab (default)

Opens the full website inside the app:

- Hub with SlabCrack, Grade Check, PokeMatch, and Queue Watch
- Sign in, binder, trades, messages — everything on the site
- In-app navigation stays on your CollecTools domain; external links open in the browser

## Queue tab (optional native bonus)

Native Pokemon Center monitor with push notifications (runs separately from the web Queue Watch page):

- Polls `pokemoncenter.com` from your phone every **10 seconds**
- Push notification when the virtual queue goes live
- Background checks on Android while monitoring is on

Use this tab if you want phone alerts without keeping a browser tab open.

## Build the APK

```bash
cd apps/pc-queue-watch
npm install
npx eas-cli login
npm run build:apk
```

Download the `.apk` from the EAS build page and install on Android.

## Dev preview

```bash
npm start
```

Use Expo Go to test UI. **Verify push + polling on a real APK** — Expo Go has limitations.

## Optional env

Create `.env`:

```
EXPO_PUBLIC_COLLECTOOLS_URL=https://slab-crack-dashboard.vercel.app
```

Point this at your production URL if it differs from the default.
