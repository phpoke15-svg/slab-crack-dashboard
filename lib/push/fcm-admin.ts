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

/** Broadcast a test queue-live alert to all native app subscribers on the FCM topic. */
export async function sendTestQueueLiveFcmAlert(
  targetUrl: string,
): Promise<{ sent: boolean; messageId?: string; reason?: string }> {
  if (!isFcmAdminConfigured()) {
    return { sent: false, reason: "fcm_not_configured" }
  }

  initFirebaseAdmin()

  try {
    const messageId = await admin.messaging().send({
      topic: getFcmTopic(),
      notification: {
        title: "🚨 Pokémon Center Queue is LIVE! (TEST)",
        body: "This is a test queue-live alert from CollecTools PokeWatch.",
      },
      data: {
        url: targetUrl,
        type: "queue_live_test",
      },
      android: {
        priority: "high",
        notification: {
          channelId: "pokemon_center_alerts",
          priority: "max",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
    })

    return { sent: true, messageId }
  } catch (error) {
    const message = error instanceof Error ? error.message : "fcm_send_failed"
    return { sent: false, reason: message }
  }
}
