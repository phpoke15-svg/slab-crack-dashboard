# CollecTools Mobile App

Installable **Android / iOS** app (v1.4.4) that loads your live **CollecTools website** full-screen (no bottom tabs). Native **PokeWatch** opens from the site when you tap **Open native PokeWatch** on `/pokewatch`.

**PokeWatch is Pro-only** — sign in on the site, open PokeWatch once to link your token, then start the in-app monitor.

## Security model

- Pro bookmarklet tokens are minted server-side (HMAC, 30-day TTL) and verified on every report
- The native monitor **never injects your token into Pokemon Center** — DOM scans post to React Native, and the app reports via HTTPS with the token in a header only
- Pokemon Center WebView navigation is restricted to `pokemoncenter.com` and `queue-it.net`
- Bookmarklet sync pop-ups post back to CollecTools with a fixed origin (not `*`)

Theme: dark background (`#0b0e14`) + **white / mint-green** (`#4ade80`) accents (same as the website). Brand mark is white **C** + mint **T**.

> **Do not use the old solid-blue asset wipe.** `npm run verify:assets` only checks that the mint brand PNGs are intact. If icons look solid blue, restore with:
> `git checkout HEAD -- apps/pc-queue-watch/assets/`

Store path: see **[STORE.md](./STORE.md)**.

## Home (full-screen site)

Opens the full website:

- Hub with SlabCrack, PokeMatch, and PokeWatch
- Sign in, binder, trades, messages
- In-app navigation stays on your CollecTools domain; external links open in the browser
- Visiting `/pokewatch` while Pro bridges your monitor token

## Native PokeWatch (from the site)

1. Open **PokeWatch** from the CollecTools hub (or tap **Open native PokeWatch** on `/pokewatch`)
2. Tap **Start in-app monitor** — Pokemon Center loads in a dedicated WebView
3. Pass any Imperva / bot check once
4. Leave that screen open during drops for a local push when the queue goes live
5. Optional: copy the bookmarklet for a second tab in your mobile browser

## Build internal APK

```bash
cd apps/pc-queue-watch
git pull
npm install
npm run verify:assets   # must say mint/dark brand package intact
npx eas-cli login
npm run build:apk
```

Uninstall the old APK before installing the new one so Android refreshes the launcher icon.

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
EXPO_PUBLIC_COLLECTOOLS_URL=https://www.collectools.app
```
