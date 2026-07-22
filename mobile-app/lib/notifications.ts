import Constants from "expo-constants"
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"

export const FCM_TOPIC = "pokemon_center_alerts"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export function getSubscribeApiUrl(): string {
  const extra = Constants.expoConfig?.extra as { subscribeApiUrl?: string } | undefined
  return extra?.subscribeApiUrl ?? "http://127.0.0.1:8787/subscribe"
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("[mobile] Push notifications require a physical device")
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== "granted") {
    return null
  }

  if (Device.osName === "Android") {
    await Notifications.setNotificationChannelAsync("pokemon_center_alerts", {
      name: "Pokémon Center queue alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    })
  }

  const tokenResult = await Notifications.getDevicePushTokenAsync()
  return tokenResult.data
}

export async function subscribeToAlertsTopic(deviceToken: string): Promise<void> {
  const response = await fetch(getSubscribeApiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: deviceToken, topic: FCM_TOPIC }),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Subscribe failed (${response.status})`)
  }
}

export function extractQueueUrl(data: Record<string, unknown> | undefined): string | null {
  const url = data?.url
  return typeof url === "string" && url.startsWith("http") ? url : null
}
