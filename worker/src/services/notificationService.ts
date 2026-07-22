import { config } from "../config.js"
import { sendQueueLiveAlert } from "../fcm.js"
import { formatProbeError } from "../probe-utils.js"
import { claimNotificationCooldown, publishQueueDetectedEvent } from "./notification-cooldown.js"
import { broadcastQueueDetected } from "./websocket-broadcast.js"

export type QueueNotificationDetails = {
  url: string
  status: number
  detectedAt?: string
}

export type QueueNotificationDispatchResult = {
  skipped: boolean
  reason?: string
  oneSignalId?: string | null
  fcmMessageId?: string | null
  websocketClients?: number
}

const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications"
const DEFAULT_PUSH_TITLE = "🚨 Queue Live: Pokémon Center!"
const DEFAULT_PUSH_BODY = "Tap to join the queue now."

const pendingJobs: QueueNotificationDetails[] = []
let draining = false

function isOneSignalConfigured(): boolean {
  return Boolean(config.onesignalAppId && config.onesignalRestApiKey)
}

function isFcmConfigured(): boolean {
  return Boolean(config.firebaseServiceAccountJson)
}

export async function sendOneSignalQueueNotification(
  details: QueueNotificationDetails,
): Promise<string | null> {
  if (!isOneSignalConfigured()) {
    return null
  }

  const targetUrl = details.url || config.queueDeepLink
  const response = await fetch(ONESIGNAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Key ${config.onesignalRestApiKey}`,
    },
    body: JSON.stringify({
      app_id: config.onesignalAppId,
      filters: [
        { field: "tag", key: "membership_tier", relation: "=", value: "pro" },
        { operator: "OR" },
        { field: "tag", key: "membership_tier", relation: "=", value: "supreme" },
      ],
      headings: { en: DEFAULT_PUSH_TITLE },
      contents: { en: DEFAULT_PUSH_BODY },
      url: targetUrl,
      priority: 10,
      data: {
        type: "queue_live",
        url: targetUrl,
        status: String(details.status),
      },
    }),
  })

  const body = (await response.json().catch(() => null)) as { id?: string; errors?: string[] } | null
  if (!response.ok) {
    const reason = body?.errors?.join(", ") || response.statusText
    throw new Error(`OneSignal request failed (${response.status}): ${reason}`)
  }

  return body?.id ?? null
}

export type QueueNotificationOptions = {
  /** Bypass the queue-live cooldown (test endpoint only). */
  skipCooldown?: boolean
}

export async function sendQueueNotification(
  details: QueueNotificationDetails,
  options?: QueueNotificationOptions,
): Promise<QueueNotificationDispatchResult> {
  const detectedAt = details.detectedAt ?? new Date().toISOString()
  const targetUrl = details.url || config.queueDeepLink

  if (!options?.skipCooldown) {
    const claimed = await claimNotificationCooldown("queue_live")
    if (!claimed) {
      return { skipped: true, reason: "cooldown_active" }
    }
  }

  const payload = JSON.stringify({
    ...details,
    url: targetUrl,
    detectedAt,
  })
  await publishQueueDetectedEvent(payload)

  const websocketClients = broadcastQueueDetected({
    url: targetUrl,
    status: details.status,
    detectedAt,
  })

  let oneSignalId: string | null = null
  let fcmMessageId: string | null = null

  if (isOneSignalConfigured()) {
    try {
      oneSignalId = await sendOneSignalQueueNotification({ ...details, url: targetUrl, detectedAt })
    } catch (error) {
      console.warn(`[notification] OneSignal dispatch failed: ${formatProbeError(error)}`)
    }
  }

  if (isFcmConfigured()) {
    try {
      fcmMessageId = await sendQueueLiveAlert(targetUrl)
    } catch (error) {
      console.warn(`[notification] FCM dispatch failed: ${formatProbeError(error)}`)
    }
  }

  if (!oneSignalId && !fcmMessageId && websocketClients === 0) {
    console.warn("[notification] Queue alert dispatched with no push channels configured")
  } else {
    console.log(
      `[notification] Queue alert dispatched url=${targetUrl} oneSignal=${oneSignalId ?? "skipped"} fcm=${fcmMessageId ?? "skipped"} wsClients=${websocketClients}`,
    )
  }

  return {
    skipped: false,
    oneSignalId,
    fcmMessageId,
    websocketClients,
  }
}

async function drainNotificationQueue(): Promise<void> {
  if (draining) return
  draining = true

  while (pendingJobs.length > 0) {
    const job = pendingJobs.shift()
    if (!job) continue

    try {
      await sendQueueNotification(job)
    } catch (error) {
      console.warn(`[notification] Async dispatch failed: ${formatProbeError(error)}`)
    }
  }

  draining = false
}

/** Non-blocking enqueue — keeps the Playwright monitoring loop responsive. */
export function dispatchQueueNotificationAsync(details: QueueNotificationDetails): void {
  pendingJobs.push(details)
  setImmediate(() => {
    void drainNotificationQueue()
  })
}

export function getPendingNotificationCountForTests(): number {
  return pendingJobs.length
}

export function resetNotificationQueueForTests(): void {
  pendingJobs.length = 0
  draining = false
}
