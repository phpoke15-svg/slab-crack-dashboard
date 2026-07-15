import AsyncStorage from "@react-native-async-storage/async-storage"
import { COLLECTOOLS_BASE_URL } from "../config"
import type { WebViewReport } from "./service"
import { SESSION_KEY, TOKEN_KEY } from "./pro-access"

export async function getOrCreateMobileSessionId(): Promise<string> {
  const existing = await AsyncStorage.getItem(SESSION_KEY)
  if (existing) return existing
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await AsyncStorage.setItem(SESSION_KEY, id)
  return id
}

export async function saveQueueWatchCredentials(input: {
  sessionId?: string
  token?: string
}): Promise<{ tokenChanged: boolean; hasToken: boolean }> {
  let tokenChanged = false
  let hasToken = Boolean((await AsyncStorage.getItem(TOKEN_KEY))?.trim())

  if (input.sessionId?.trim()) {
    await AsyncStorage.setItem(SESSION_KEY, input.sessionId.trim())
  }

  if (input.token !== undefined) {
    const next = input.token.trim()
    const prev = (await AsyncStorage.getItem(TOKEN_KEY))?.trim() || ""
    if (next) {
      if (next !== prev) tokenChanged = true
      await AsyncStorage.setItem(TOKEN_KEY, next)
      hasToken = true
    } else {
      if (prev) tokenChanged = true
      await AsyncStorage.removeItem(TOKEN_KEY)
      hasToken = false
    }
  }

  return { tokenChanged, hasToken }
}

/** Pull Pro bookmarklet token/session from the CollecTools WebView localStorage. */
export const BRIDGE_INJECT = `
(function(){
  try {
    var sid = localStorage.getItem('pc-queue-watch-session') || '';
    var tok = localStorage.getItem('pc-queue-watch-token') || '';
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'collectools-qw-creds',
      sessionId: sid,
      token: tok
    }));
  } catch (e) {}
  true;
})();
`

let lastReportAt = 0
const REPORT_MIN_MS = 8_000

/** Sync WebView queue state to CollecTools so /pokewatch shows connected. */
export async function reportQueueStateToServer(report: WebViewReport): Promise<void> {
  const now = Date.now()
  const challenge = Boolean(
    report.live ||
      (Array.isArray(report.signals) &&
        report.signals.some((s) => /imperva|captcha/i.test(s.id))),
  )
  const force = Boolean(report.live) || challenge
  if (!force && now - lastReportAt < REPORT_MIN_MS) return

  const token = (await AsyncStorage.getItem(TOKEN_KEY))?.trim()
  if (!token) return

  const sessionId = await getOrCreateMobileSessionId()
  lastReportAt = now

  try {
    await fetch(`${COLLECTOOLS_BASE_URL}/api/pokemon-center/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Queue-Watch-Token": token,
      },
      body: JSON.stringify({
        sessionId,
        live: Boolean(report.live),
        confidence: report.confidence ?? 0,
        signals: report.signals ?? [],
        pageUrl: report.pageUrl,
        source: "mobile",
        token,
      }),
    })
  } catch {
    // Offline / network — local alerts still work for Pro sessions
  }
}
