import { config } from "../config.js"
import { formatProbeError } from "../probe-utils.js"
import { claimCooldown } from "./notification-cooldown.js"

const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications"
const FAILURE_COOLDOWN_KEY = "worker_failure_alert"

export type FailureAlertResult = {
  sent: boolean
  skipped?: boolean
  reason?: string
  oneSignalId?: string | null
}

function isOneSignalConfigured(): boolean {
  return Boolean(config.onesignalAppId && config.onesignalRestApiKey)
}

function formatFailureMessage(error: unknown, context?: string): string {
  const timestamp = new Date().toISOString()
  const message = formatProbeError(error)
  return context ? `[${timestamp}] ${context}: ${message}` : `[${timestamp}] ${message}`
}

async function sendOneSignalFailureAlert(body: string): Promise<string | null> {
  if (!isOneSignalConfigured()) {
    return null
  }

  const response = await fetch(ONESIGNAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Key ${config.onesignalRestApiKey}`,
    },
    body: JSON.stringify({
      app_id: config.onesignalAppId,
      filters: [
        { field: "tag", key: "role", relation: "=", value: "admin" },
        { operator: "OR" },
        { field: "tag", key: "membership_tier", relation: "=", value: "supreme" },
      ],
      headings: { en: "⚠️ PokeWatch Worker Failure" },
      contents: { en: body.slice(0, 500) },
      priority: 10,
      data: {
        type: "worker_failure",
        timestamp: new Date().toISOString(),
      },
    }),
  })

  const payload = (await response.json().catch(() => null)) as { id?: string; errors?: string[] } | null
  if (!response.ok) {
    const reason = payload?.errors?.join(", ") || response.statusText
    throw new Error(`OneSignal failure alert failed (${response.status}): ${reason}`)
  }

  return payload?.id ?? null
}

/** Notify admins/supreme users about worker failures (rate-limited). */
export async function sendFailureAlert(
  error: unknown,
  context?: string,
): Promise<FailureAlertResult> {
  const message = formatFailureMessage(error, context)

  if (!claimCooldown(FAILURE_COOLDOWN_KEY, config.failureAlertCooldownMs)) {
    console.warn(`[worker] Failure alert suppressed (cooldown active): ${message}`)
    return { sent: false, skipped: true, reason: "cooldown_active" }
  }

  console.error(`[worker] Failure alert: ${message}`)

  if (!isOneSignalConfigured()) {
    console.warn("[worker] OneSignal not configured — failure logged only")
    return { sent: false, skipped: true, reason: "onesignal_not_configured" }
  }

  try {
    const oneSignalId = await sendOneSignalFailureAlert(message)
    console.log(`[worker] Failure alert sent oneSignal=${oneSignalId ?? "none"}`)
    return { sent: true, oneSignalId }
  } catch (alertError) {
    console.warn(`[worker] Failure alert dispatch failed: ${formatProbeError(alertError)}`)
    return { sent: false, reason: formatProbeError(alertError) }
  }
}

export { formatFailureMessage }
