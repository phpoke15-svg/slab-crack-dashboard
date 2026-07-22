"use client"

const VAPID_STORAGE_KEY = "collectools-push-endpoint"
const PUSH_ENABLED_KEY = "collectools-push-alerts-enabled"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

export type PushOptInPrefs = {
  queueLive?: boolean
  walmartWednesday?: boolean
  socialAlerts?: boolean
  priceAlerts?: boolean
  giveawayReminders?: boolean
}

async function getRegistration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" })
}

export async function getPushPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isWebPushSupported()) return "unsupported"
  return Notification.permission
}

async function postSubscription(
  json: { endpoint: string; keys: { p256dh: string; auth: string } },
  prefs: PushOptInPrefs,
): Promise<Response> {
  return fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      queueLive: prefs.queueLive ?? false,
      walmartWednesday: prefs.walmartWednesday ?? false,
      socialAlerts: prefs.socialAlerts !== false,
      priceAlerts: prefs.priceAlerts !== false,
      giveawayReminders: prefs.giveawayReminders ?? false,
    }),
  })
}

export async function enableWebPush(prefs: PushOptInPrefs): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isWebPushSupported()) {
    return {
      ok: false,
      error:
        "This browser does not support Web Push. On iPhone, add CollecTools to your Home Screen first, then enable alerts.",
    }
  }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    return { ok: false, error: "Notification permission was blocked." }
  }

  const keyRes = await fetch("/api/push/vapid-public-key", { cache: "no-store" })
  if (!keyRes.ok) {
    const body = (await keyRes.json().catch(() => null)) as { error?: string } | null
    return { ok: false, error: body?.error || "Push is not configured on the server yet." }
  }
  const { publicKey } = (await keyRes.json()) as { publicKey: string }

  const registration = await getRegistration()
  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, error: "Could not create a push subscription." }
  }

  const res = await postSubscription(
    { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
    prefs,
  )

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    return { ok: false, error: body?.error || "Could not save push subscription." }
  }

  try {
    localStorage.setItem(VAPID_STORAGE_KEY, json.endpoint)
    localStorage.setItem(PUSH_ENABLED_KEY, "1")
  } catch {
    // ignore
  }

  return { ok: true }
}

export async function disableWebPush(): Promise<void> {
  if (!isWebPushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration("/")
  const subscription = await registration?.pushManager.getSubscription()
  const endpoint = subscription?.endpoint || localStorage.getItem(VAPID_STORAGE_KEY)

  if (subscription) await subscription.unsubscribe()

  if (endpoint) {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    }).catch(() => null)
  }

  try {
    localStorage.removeItem(VAPID_STORAGE_KEY)
    localStorage.removeItem(PUSH_ENABLED_KEY)
  } catch {
    // ignore
  }
}

/** True when this browser has granted permission and an active push subscription. */
export async function hasActivePushSubscription(): Promise<boolean> {
  if (!isWebPushSupported()) return false
  if (Notification.permission !== "granted") return false

  try {
    if (localStorage.getItem(PUSH_ENABLED_KEY) === "1") {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" })
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription?.endpoint) return true
      localStorage.removeItem(PUSH_ENABLED_KEY)
    }

    await navigator.serviceWorker.register("/sw.js", { scope: "/" })
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    const active = Boolean(subscription?.endpoint)
    if (active) {
      try {
        localStorage.setItem(PUSH_ENABLED_KEY, "1")
        if (subscription?.endpoint) {
          localStorage.setItem(VAPID_STORAGE_KEY, subscription.endpoint)
        }
      } catch {
        // ignore
      }
    }
    return active
  } catch {
    return false
  }
}

/** Re-register an existing browser subscription with the server (fixes stale/missing DB rows). */
export async function resyncWebPushSubscription(
  prefs: PushOptInPrefs,
): Promise<{ ok: true } | { ok: false; error: string } | { ok: true; skipped: true }> {
  if (!isWebPushSupported()) return { ok: true, skipped: true }
  if (Notification.permission !== "granted") return { ok: true, skipped: true }

  try {
    const registration = await getRegistration()
    await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return { ok: true, skipped: true }

    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: true, skipped: true }
    }

    const res = await postSubscription(
      { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
      prefs,
    )

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      return { ok: false, error: body?.error || "Could not sync push subscription." }
    }

    try {
      localStorage.setItem(VAPID_STORAGE_KEY, json.endpoint)
      localStorage.setItem(PUSH_ENABLED_KEY, "1")
    } catch {
      // ignore
    }

    return { ok: true }
  } catch {
    return { ok: true, skipped: true }
  }
}

export type ServerPushStatus = {
  signedIn: boolean
  queueLiveOnServer: boolean
}

/** Whether the signed-in account has queue alerts stored server-side. */
export async function fetchServerPushStatus(): Promise<ServerPushStatus | null> {
  try {
    const res = await fetch("/api/push/subscribe/status", {
      cache: "no-store",
      credentials: "include",
    })
    if (!res.ok) return null
    return (await res.json()) as ServerPushStatus
  } catch {
    return null
  }
}
