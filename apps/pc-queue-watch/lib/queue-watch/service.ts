import * as Notifications from "expo-notifications"
import * as Linking from "expo-linking"
import { Platform } from "react-native"
import { POKEMON_CENTER_URL } from "../config"
import { checkPokemonCenterQueue, type QueueSignal } from "./detect"

export const QUEUE_WATCH_TASK = "collectools-queue-watch-background"
export const POLL_MS = 10_000

export type QueueCheckState = {
  live: boolean
  confidence: number
  blocked?: boolean
  signals: QueueSignal[]
  checkedAt: string
  url?: string
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

  private emit(state: QueueCheckState) {
    this.lastState = state
    for (const listener of this.listeners) listener(state)
  }

  private async notifyLive(signals: QueueSignal[]) {
    const detail =
      signals.length > 0 ? signals.map((s) => s.label).join(" · ") : "Queue activity detected on Pokemon Center"

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

  async runCheck() {
    const result = await checkPokemonCenterQueue()
    const state: QueueCheckState = {
      live: result.live,
      confidence: result.confidence,
      blocked: result.blocked,
      signals: result.signals,
      checkedAt: new Date().toISOString(),
      url: result.url,
    }

    this.emit(state)

    if (result.live && !this.lastLive) {
      await this.notifyLive(result.signals)
    }

    this.lastLive = result.live
    return state
  }

  async start() {
    await this.init()
    if (this.active) return

    this.active = true
    await this.runCheck()
    this.pollTimer = setInterval(() => {
      void this.runCheck()
    }, POLL_MS)
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.active = false
    this.lastLive = false
  }
}

export const queueWatchService = new QueueWatchService()
