import admin from "firebase-admin"

let initialized = false

function loadServiceAccount(): admin.ServiceAccount {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (json) {
    return JSON.parse(json) as admin.ServiceAccount
  }
  throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured")
}

export function isFcmAdminConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim())
}

export function initFirebaseAdmin(): void {
  if (initialized) return
  admin.initializeApp({
    credential: admin.credential.cert(loadServiceAccount()),
  })
  initialized = true
}

export function getFcmTopic(): string {
  return process.env.FCM_TOPIC?.trim() || "pokemon_center_alerts"
}

export async function subscribeDeviceTokenToQueueTopic(deviceToken: string): Promise<void> {
  initFirebaseAdmin()
  await admin.messaging().subscribeToTopic([deviceToken], getFcmTopic())
}
