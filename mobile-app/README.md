# Pokémon Center Queue Alerts (Expo)

Minimal Expo app that subscribes to the worker's FCM topic and opens queue URLs in the system browser.

> **Note:** This repo already uses Next.js `app/` for the web dashboard. The mobile client lives in `mobile-app/` to avoid conflicting with that directory.

## Setup

```bash
cd mobile-app
npm install
```

Configure the worker subscribe endpoint in `app.json`:

```json
"extra": {
  "subscribeApiUrl": "https://your-worker-host:8787/subscribe"
}
```

Add `google-services.json` for Android FCM (Firebase console → Project settings → Android app).

## Run

```bash
npm start
```

Use a **physical device** or dev client build — simulators cannot receive real push notifications.

## Flow

1. Request notification permissions on launch
2. Read native device push token via `Notifications.getDevicePushTokenAsync()`
3. `POST /subscribe` on the worker so Firebase Admin adds the token to `pokemon_center_alerts`
4. When the user taps an alert, read `data.url` and call `WebBrowser.openBrowserAsync(url)`
