/** True when the site runs inside the CollecTools iOS/Android WebView shell. */
export function isNativeAppShell(): boolean {
  if (typeof document === "undefined") return false
  return document.documentElement.classList.contains("native-app")
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
