import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { AppState } from "react-native"
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake"
import { registerQueueBackgroundTask } from "./background"
import {
  queueWatchService,
  type QueueCheckState,
  type WebViewReport,
} from "./service"
import { reportQueueStateToServer } from "./report-to-server"

const AUTO_START_KEY = "collectools-queue-auto-start"
const KEEP_AWAKE_TAG = "collectools-queue-watch"

type QueueWatchContextValue = {
  monitoring: boolean
  autoStart: boolean
  state: QueueCheckState | null
  error: string | null
  webViewConnected: boolean
  start: () => Promise<void>
  stop: () => void
  setAutoStart: (enabled: boolean) => Promise<void>
  applyWebViewReport: (report: WebViewReport) => Promise<void>
}

const QueueWatchContext = createContext<QueueWatchContextValue | null>(null)

export function QueueWatchProvider({ children }: { children: ReactNode }) {
  const [monitoring, setMonitoring] = useState(queueWatchService.isActive())
  const [autoStart, setAutoStartState] = useState(true)
  const [state, setState] = useState<QueueCheckState | null>(queueWatchService.getState())
  const [error, setError] = useState<string | null>(null)
  const [webViewConnected, setWebViewConnected] = useState(false)

  const start = useCallback(async () => {
    setError(null)
    try {
      await queueWatchService.start()
      await registerQueueBackgroundTask()
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG)
      setMonitoring(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start monitoring")
      setMonitoring(false)
    }
  }, [])

  const stop = useCallback(() => {
    queueWatchService.stop()
    deactivateKeepAwake(KEEP_AWAKE_TAG)
    setMonitoring(false)
    setWebViewConnected(false)
    setState((prev) => (prev ? { ...prev, live: false } : prev))
  }, [])

  const setAutoStart = useCallback(async (enabled: boolean) => {
    setAutoStartState(enabled)
    await AsyncStorage.setItem(AUTO_START_KEY, enabled ? "1" : "0")
  }, [])

  const applyWebViewReport = useCallback(async (report: WebViewReport) => {
    setWebViewConnected(true)
    await queueWatchService.applyWebViewReport(report)
    void reportQueueStateToServer(report)
  }, [])

  useEffect(() => {
    void queueWatchService.init()

    const unsubscribe = queueWatchService.subscribe((next) => {
      setState(next)
      setMonitoring(queueWatchService.isActive())
      if (next.source === "webview") setWebViewConnected(true)
    })

    void AsyncStorage.getItem(AUTO_START_KEY).then(async (value) => {
      const enabled = value !== "0"
      setAutoStartState(enabled)
      if (enabled) await start()
    })

    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" && queueWatchService.isActive()) {
        // Soft fallback only if WebView heartbeats went stale while backgrounded.
        if (!queueWatchService.hasFreshWebView()) {
          void queueWatchService.runCheck()
        }
      }
    })

    return () => {
      unsubscribe()
      sub.remove()
    }
  }, [start])

  const value = useMemo(
    () => ({
      monitoring,
      autoStart,
      state,
      error,
      webViewConnected,
      start,
      stop,
      setAutoStart,
      applyWebViewReport,
    }),
    [
      monitoring,
      autoStart,
      state,
      error,
      webViewConnected,
      start,
      stop,
      setAutoStart,
      applyWebViewReport,
    ],
  )

  return <QueueWatchContext.Provider value={value}>{children}</QueueWatchContext.Provider>
}

export function useQueueWatch() {
  const ctx = useContext(QueueWatchContext)
  if (!ctx) throw new Error("useQueueWatch must be used within QueueWatchProvider")
  return ctx
}
