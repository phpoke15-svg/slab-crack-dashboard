import * as Notifications from "expo-notifications"
import * as Linking from "expo-linking"
import { Platform } from "react-native"
import { POKEMON_CENTER_URL } from "../config"
import { checkPokemonCenterQueue, type QueueSignal } from "./detect"

export const QUEUE_WATCH_TASK = "collectools-queue-watch-background"
/** Weak fallback only — Imperva often blocks headless fetch. Prefer WebView. */
export const POLL_MS = 45_000
export const POLL_MS_BLOCKED = 120_000
/** If WebView heartbeats stop, fall back to headless fetch after this. */
export const WEBVIEW_STALE_MS = 45_000

export type QueueCheckState = {
  live: boolean
  confidence: number
  blocked?: boolean
  signals: QueueSignal[]
  checkedAt: string
  url?: string
  source?: "webview" | "fetch"
}

export type WebViewReport = {
  live: boolean
  confidence: number
  signals?: QueueSignal[]
  blocked?: boolean
  pageUrl?: string
  checkedAt?: string
}

type Listener = (state: QueueCheckState) => void

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

class QueueWatchService {
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private listeners = new Set<Listener>()
  private lastLive = false
  private active = false
  private lastState: QueueCheckState | null = null
  private notificationReady = false
  private lastWebViewAt = 0
  private mode: "webview" | "fetch" = "webview"

  async init() {
    if (this.notificationReady) return
    await this.ensureNotifications()
    Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url
      if (typeof url === "string") void Linking.openURL(url)
      else void Linking.openURL(POKEMON_CENTER_URL)
    })
    this.notificationReady = true
  }

  private async ensureNotifications() {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("queue-live", {
        name: "Pokemon Center queue alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 150, 300],
        sound: "default",
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      })
      await Notifications.setNotificationChannelAsync("queue-watch-running", {
        name: "Queue Watch running",
        importance: Notifications.AndroidImportance.LOW,
        sound: undefined,
      })
    }

    const current = await Notifications.getPermissionsAsync()
    if (current.status !== "granted") {
      await Notifications.requestPermissionsAsync()
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    if (this.lastState) listener(this.lastState)
    return () => this.listeners.delete(listener)
  }

  getState() {
    return this.lastState
  }

  isActive() {
    return this.active
  }

  getMode() {
    return this.mode
  }

  hasFreshWebView(): boolean {
    return this.lastWebViewAt > 0 && Date.now() - this.lastWebViewAt < WEBVIEW_STALE_MS
  }

  private emit(state: QueueCheckState) {
    this.lastState = state
    for (const listener of this.listeners) listener(state)
  }

  private async notifyLive(signals: QueueSignal[]) {
    const detail =
      signals.length > 0
        ? signals.map((s) => s.label).join(" · ")
        : "Queue activity detected on Pokemon Center"

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🚨 Pokemon Center queue is LIVE",
        body: detail,
        data: { url: POKEMON_CENTER_URL },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        sticky: Platform.OS === "android",
      },
      trigger: null,
    })
  }

  private async setRunningNotification(on: boolean) {
    if (Platform.OS !== "android") return
    try {
      if (on) {
        await Notifications.scheduleNotificationAsync({
          identifier: "queue-watch-running",
          content: {
            title: "Queue Watch is running",
            body: "Keep the Queue tab open. Pass any bot check on Pokemon Center, then leave it.",
            data: { url: POKEMON_CENTER_URL },
            sticky: true,
            autoDismiss: false,
          },
          trigger: null,
        })
      } else {
        await Notifications.dismissNotificationAsync("queue-watch-running")
      }
    } catch {
      // optional UX aid
    }
  }

  /**
   * Primary path: reports from the in-app Pokemon Center WebView
   * (user already passed Imperva in a real browser session).
   */
  async applyWebViewReport(report: WebViewReport) {
    if (!this.active) return

    this.lastWebViewAt = Date.now()
    this.mode = "webview"
    // WebView is healthy — pause headless hammering.
    this.clearPoll()

    const signals = Array.isArray(report.signals) ? report.signals : []
    const state: QueueCheckState = {
      live: Boolean(report.live) && !report.blocked,
      confidence: report.blocked ? 0 : typeof report.confidence === "number" ? report.confidence : 0,
      blocked: Boolean(report.blocked),
      signals,
      checkedAt: report.checkedAt || new Date().toISOString(),
      url: report.pageUrl || POKEMON_CENTER_URL,
      source: "webview",
    }

    this.emit(state)

    if (state.live && !this.lastLive) {
      await this.notifyLive(signals)
    }
    this.lastLive = state.live
    return state
  }

  /** Weak fallback when WebView heartbeats go stale (app backgrounded, etc.). */
  async runCheck() {
    if (!this.active) return this.lastState

    // Prefer WebView; only fetch if heartbeats are stale.
    if (this.hasFreshWebView()) {
      return this.lastState
    }

    this.mode = "fetch"
    const result = await checkPokemonCenterQueue()
    const state: QueueCheckState = {
      live: result.live,
      confidence: result.confidence,
      blocked: result.blocked,
      signals: result.signals,
      checkedAt: new Date().toISOString(),
      url: result.url,
      source: "fetch",
    }

    this.emit(state)

    if (result.live && !this.lastLive) {
      await this.notifyLive(result.signals)
    }

    this.lastLive = result.live

    if (this.active && !this.hasFreshWebView()) {
      this.reschedule(result.blocked ? POLL_MS_BLOCKED : POLL_MS)
    }

    return state
  }

  private clearPoll() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private reschedule(ms: number) {
    this.clearPoll()
    this.pollTimer = setInterval(() => {
      void this.runCheck()
    }, ms)
  }

  async start() {
    await this.init()
    if (this.active) return

    this.active = true
    this.mode = "webview"
    this.lastWebViewAt = 0
    await this.setRunningNotification(true)

    // Soft fallback only — primary detection is WebView inject.
    this.reschedule(POLL_MS)
    this.emit({
      live: false,
      confidence: 0,
      signals: [],
      checkedAt: new Date().toISOString(),
      url: POKEMON_CENTER_URL,
      source: "webview",
      blocked: false,
    })
  }

  stop() {
    this.clearPoll()
    this.active = false
    this.lastLive = false
    this.lastWebViewAt = 0
    this.mode = "webview"
    void this.setRunningNotification(false)
  }
}

export const queueWatchService = new QueueWatchService()
