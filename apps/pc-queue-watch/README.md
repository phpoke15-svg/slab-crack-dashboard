# CollecTools Mobile App

Installable **Android / iOS** app (v1.3.3) that loads your live **CollecTools website** full-screen (no bottom tabs). Native **Queue Watch** opens from the site when you tap **Open native Queue Watch** on `/queue-watch`.

**Queue Watch is Pro-only** — sign in on the site, open Queue Watch once to link your token, then start native monitoring.

Theme: dark background + **white / mint-green** accents (same as the website). Rebuild the APK after UI changes.

Store path: see **[STORE.md](./STORE.md)**.

## Home (full-screen site)

Opens the full website:

- Hub with SlabCrack, PokeMatch, and Queue Watch
- Sign in, binder, trades, messages
- In-app navigation stays on your CollecTools domain; external links open in the browser
- Visiting `/queue-watch` while Pro bridges your monitor token

## Native Queue Watch (from the site)

1. Open **Queue Watch** from the CollecTools hub
2. Tap **Open native Queue Watch** (green button at the bottom)
3. Tap **Start monitoring** — Pokemon Center loads in-app
4. Pass any Imperva / bot check once
5. Leave that screen open during drops for a local push when the queue goes live

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
