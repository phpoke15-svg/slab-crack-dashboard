# Firebase push setup (CollecTools app)

Native queue alerts require the **same Firebase project** as the server (`collectools-28131`).

## 1. Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/) → project **collectools-28131**
2. **Project settings** → **Your apps**

### Android (`com.collectools.app`)

- Add app if missing
- Download **`google-services.json`**
- Save to: `apps/pc-queue-watch/google-services.json` (not committed — see `.gitignore`)

### iOS (`com.collectools.app`)

- Add app if missing
- Download **`GoogleService-Info.plist`**
- Save to: `apps/pc-queue-watch/GoogleService-Info.plist`
- Upload your **APNs key** (.p8) under Cloud Messaging → Apple app configuration

## 2. Supabase table

Run once in Supabase SQL editor:

`supabase/fcm-device-tokens.sql`

## 3. Rebuild the app

```bash
cd apps/pc-queue-watch
npm run build:apk   # or build:android / build:ios
```

Install the new build, then on `/pokewatch` tap **Enable queue alerts**.

If registration fails, the app shows an alert with the Firebase error (wrong token, missing google-services, etc.).

## 4. Verify

```bash
curl -sS https://www.collectools.app/api/health | jq '.checks.fcmDeviceTokens'
```

Should be `1` or more after enabling on your phone.

Then test push:

```bash
curl -sS -X POST "https://www.collectools.app/api/pokemon-center/test-queue-alert?force=1" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Look for `"registeredDeviceCount": 1` and `"fcmDevices": { "sent": 1 }`.
