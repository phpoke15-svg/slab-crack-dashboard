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

export type FcmTopicSubscribeResult = {
  successCount: number
  failureCount: number
  errors: string[]
}

export async function subscribeDeviceTokenToQueueTopic(
  deviceToken: string,
  topic = getFcmTopic(),
): Promise<FcmTopicSubscribeResult> {
  initFirebaseAdmin()
  const response = await admin.messaging().subscribeToTopic([deviceToken], topic)
  const errors = (response.errors ?? []).map((entry) => entry.error.message)
  const successCount = response.successCount ?? 0
  const failureCount = response.failureCount ?? 0

  if (successCount === 0) {
    throw new Error(
      errors[0] ||
        "FCM topic subscribe failed. The device token is invalid or from a different Firebase project.",
    )
  }

  return { successCount, failureCount, errors }
}

export type FcmMulticastResult = {
  sent: number
  failed: number
  errors: string[]
}

function buildQueueLiveMessage(
  targetUrl: string,
  test: boolean,
): Pick<admin.messaging.Message, "notification" | "data" | "android" | "apns"> {
  return {
    notification: {
      title: test
        ? "🚨 Pokémon Center Queue is LIVE! (TEST)"
        : "🚨 Pokémon Center queue is LIVE",
      body: test
        ? "This is a test queue-live alert from CollecTools PokeWatch."
        : "Tap to open the queue in your browser.",
    },
    data: {
      url: targetUrl,
      type: test ? "queue_live_test" : "queue_live",
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
  }
}

export async function sendQueueLiveToDeviceTokens(
  tokens: string[],
  targetUrl: string,
  options?: { test?: boolean },
): Promise<FcmMulticastResult> {
  if (!isFcmAdminConfigured()) {
    return { sent: 0, failed: 0, errors: ["fcm_not_configured"] }
  }
  if (tokens.length === 0) {
    return { sent: 0, failed: 0, errors: ["no_device_tokens"] }
  }

  initFirebaseAdmin()
  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    ...buildQueueLiveMessage(targetUrl, options?.test === true),
  })

  const errors = response.responses
    .map((entry, index) => (entry.success ? null : entry.error?.message || `token_${index}_failed`))
    .filter((value): value is string => Boolean(value))

  return {
    sent: response.successCount,
    failed: response.failureCount,
    errors,
  }
}

/** Broadcast a test queue-live alert to the FCM topic (may reach zero devices). */
export async function sendTestQueueLiveFcmTopicAlert(
  targetUrl: string,
): Promise<{ sent: boolean; messageId?: string; reason?: string }> {
  if (!isFcmAdminConfigured()) {
    return { sent: false, reason: "fcm_not_configured" }
  }

  initFirebaseAdmin()

  try {
    const messageId = await admin.messaging().send({
      topic: getFcmTopic(),
      ...buildQueueLiveMessage(targetUrl, true),
    })

    return { sent: true, messageId }
  } catch (error) {
    const message = error instanceof Error ? error.message : "fcm_send_failed"
    return { sent: false, reason: message }
  }
}

export async function sendQueueLiveAlert(targetUrl: string): Promise<string> {
  initFirebaseAdmin()
  const messageId = await admin.messaging().send({
    topic: getFcmTopic(),
    ...buildQueueLiveMessage(targetUrl, false),
  })
  return messageId
}
