# CollecTools Mobile App

Installable **Android APK** with **Queue Watch** built in natively.

## Queue Watch (native)

- Polls `pokemoncenter.com` from your **phone's network** every **10 seconds**
- **Push notification** the moment the virtual queue goes live
- Keeps monitoring when you switch to other tabs
- **Background checks** on Android (~every 5 min) while monitoring is on
- Tap the notification → opens Pokemon Center
- **Auto-start** on app launch (toggle in Queue tab)

No bookmarklet, ntfy, or Pokemon Center browser tab required.

## App tabs

| Tab | What it does |
|-----|----------------|
| **Home** | Hub + live queue status |
| **Queue** | Native queue monitor |
| **Tools** | SlabCrack, Grade Check, PokeMatch (WebView) |

## Build the APK

```bash
cd apps/pc-queue-watch
npm install
npx eas-cli login
npx eas-cli init
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

## During a drop

1. Open CollecTools
2. Queue Watch auto-starts (or tap **Start monitoring**)
3. Switch to other apps if needed — you'll get a push when queue goes live
4. Tap notification → join on Pokemon Center
