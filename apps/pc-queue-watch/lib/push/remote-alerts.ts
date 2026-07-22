import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { COLLECTOOLS_BASE_URL } from "../config"
import { getStoredQueueWatchToken } from "../queue-watch/pro-access"

export const NATIVE_PUSH_ENABLED_KEY = "collectools-native-push-enabled"
export const NATIVE_PUSH_TOKEN_KEY = "collectools-native-push-token"

const ANDROID_CHANNEL_ID = "pokemon_center_alerts"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export function extractQueueUrlFromNotificationData(
  data: Record<string, unknown> | undefined,
): string | null {
  const url = data?.url
  return typeof url === "string" && url.startsWith("http") ? url : null
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Pokemon Center queue alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 150, 300],
    sound: "default",
  })
}

async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  if (current.status === "granted") return true

  const next = await Notifications.requestPermissionsAsync()
  return next.status === "granted"
}

async function getNativeDeviceToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("[push] Native push requires a physical device")
    return null
  }

  const granted = await requestNotificationPermission()
  if (!granted) return null

  await ensureAndroidChannel()

  const tokenResult = await Notifications.getDevicePushTokenAsync()
  return tokenResult.data?.trim() || null
}

export async function isNativePushRegistered(): Promise<boolean> {
  return (await AsyncStorage.getItem(NATIVE_PUSH_ENABLED_KEY)) === "1"
}

export async function registerNativeQueueAlerts(options?: {
  queueWatchToken?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const queueWatchToken = options?.queueWatchToken ?? (await getStoredQueueWatchToken())
  if (!queueWatchToken) {
    return {
      ok: false,
      error: "Sign in on CollecTools with Pro and open PokeWatch once to link your account.",
    }
  }

  const deviceToken = await getNativeDeviceToken()
  if (!deviceToken) {
    return {
      ok: false,
      error: "Notification permission was denied or unavailable on this device.",
    }
  }

  const response = await fetch(`${COLLECTOOLS_BASE_URL}/api/push/fcm-register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Queue-Watch-Token": queueWatchToken,
      "X-Device-Platform": Platform.OS,
    },
    body: JSON.stringify({
      deviceToken,
      queueWatchToken,
      platform: Platform.OS,
    }),
  })

  const body = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) {
    return { ok: false, error: body?.error || `Register failed (${response.status})` }
  }

  await AsyncStorage.multiSet([
    [NATIVE_PUSH_ENABLED_KEY, "1"],
    [NATIVE_PUSH_TOKEN_KEY, deviceToken],
  ])

  return { ok: true }
}

/** Inject into the WebView so /pokewatch can show native push status. */
export function buildNativePushStatusInject(enabled: boolean): string {
  return `
(function(){
  try {
    localStorage.setItem("${NATIVE_PUSH_ENABLED_KEY}", ${enabled ? '"1"' : '"0"'});
  } catch (e) {}
})();
true;
`
}

export function getExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  return extra?.eas?.projectId
}
