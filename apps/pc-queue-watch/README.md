# CollecTools Mobile App

Installable **Android / iOS** app (v1.3.10) that loads your live **CollecTools website** full-screen (no bottom tabs). Native **PokeWatch** opens from the site when you tap **Open native PokeWatch** on `/pokewatch`.

**PokeWatch is Pro-only** — sign in on the site, open PokeWatch once to link your token, then start native monitoring.

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

1. Open **PokeWatch** from the CollecTools hub
2. Tap **Open native PokeWatch** (green button at the bottom)
3. Tap **Start monitoring** — Pokemon Center loads in-app
4. Pass any Imperva / bot check once
5. Leave that screen open during drops for a local push when the queue goes live

## Build internal APK

From the **repo root** (recommended — works on Windows/macOS/Linux):

```bash
git pull
npm run mobile:install
cd apps/pc-queue-watch && npx eas-cli login && cd ../..
npm run mobile:build:apk
```

Or from this app folder:

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
# from repo root
npm run mobile:build:android    # AAB for Play
npm run mobile:submit:android   # upload latest Android build to Play (draft/internal)

# or from this directory
npm run build:android
npm run submit:android
```

Do **not** run bare `eas submit` / `eas build` from the monorepo root or Desktop — EAS needs this Expo app folder (`app.json` + `eas.json`). Use the `mobile:*` / `run-eas.mjs` scripts instead. A Node `punycode` deprecation line from `eas-cli` is harmless; the runner suppresses it.

## Dev preview

```bash
npm start
```

Use Expo Go for UI. **Verify push + WebView monitoring on a real APK.**

## Env

```
EXPO_PUBLIC_COLLECTOOLS_URL=https://www.collectools.app
```
