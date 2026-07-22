/** True when the site runs inside the CollecTools iOS/Android WebView shell. */
export function isNativeAppShell(): boolean {
  if (typeof document === "undefined") return false
  return document.documentElement.classList.contains("native-app")
}

export const NATIVE_PUSH_ENABLED_STORAGE_KEY = "collectools-native-push-enabled"

export function isNativePushEnabledInWebView(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(NATIVE_PUSH_ENABLED_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function requestNativePushRegistration(): boolean {
  if (!isNativeAppShell()) return false
  const payload = JSON.stringify({ type: "enable-native-push" })
  const rn = (window as Window & { ReactNativeWebView?: { postMessage: (msg: string) => void } })
    .ReactNativeWebView
  if (!rn?.postMessage) return false
  rn.postMessage(payload)
  return true
}

export function requestNativeAppStorePurchase(priceKey: string): boolean {
  if (!isNativeAppShell()) return false
  const payload = JSON.stringify({ type: "collectools-iap-purchase", priceKey })
  const rn = (window as Window & { ReactNativeWebView?: { postMessage: (msg: string) => void } })
    .ReactNativeWebView
  if (!rn?.postMessage) return false
  rn.postMessage(payload)
  return true
}
