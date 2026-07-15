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
import {
  registerQueueBackgroundTask,
  unregisterQueueBackgroundTask,
} from "./background"
import {
  queueWatchService,
  type QueueCheckState,
  type WebViewReport,
} from "./service"
import { reportQueueStateToServer } from "./report-to-server"
import { verifyProAccess } from "./pro-access"
import { MonitorWebView } from "./monitor-webview"

const AUTO_START_KEY = "collectools-queue-auto-start"
const KEEP_AWAKE_TAG = "collectools-queue-watch"

type QueueWatchContextValue = {
  monitoring: boolean
  autoStart: boolean
  state: QueueCheckState | null
  error: string | null
  webViewConnected: boolean
  /** null while first Pro check is in flight */
  hasPro: boolean | null
  proChecking: boolean
  start: () => Promise<void>
  stop: () => void
  setAutoStart: (enabled: boolean) => Promise<void>
  applyWebViewReport: (report: WebViewReport) => Promise<void>
  refreshProAccess: () => Promise<boolean>
  setMonitorWebViewVisible: (visible: boolean) => void
}

const QueueWatchContext = createContext<QueueWatchContextValue | null>(null)

export function QueueWatchProvider({ children }: { children: ReactNode }) {
  const [monitoring, setMonitoring] = useState(queueWatchService.isActive())
  const [autoStart, setAutoStartState] = useState(true)
  const [state, setState] = useState<QueueCheckState | null>(queueWatchService.getState())
  const [error, setError] = useState<string | null>(null)
  const [webViewConnected, setWebViewConnected] = useState(false)
  const [hasPro, setHasPro] = useState<boolean | null>(null)
  const [proChecking, setProChecking] = useState(true)
  const [monitorWebViewVisible, setMonitorWebViewVisible] = useState(false)

  const stop = useCallback(() => {
    queueWatchService.stop()
    deactivateKeepAwake(KEEP_AWAKE_TAG)
    void unregisterQueueBackgroundTask()
    setMonitoring(false)
    setWebViewConnected(false)
    setState((prev) => (prev ? { ...prev, live: false } : prev))
  }, [])

  const refreshProAccess = useCallback(async () => {
    setProChecking(true)
    try {
      const result = await verifyProAccess()
      setHasPro(result.hasPro)
      if (!result.hasPro) {
        stop()
        // Only clear auto-start preference when Pro was revoked, not when never linked.
        if (result.reason === "forbidden") {
          await AsyncStorage.setItem(AUTO_START_KEY, "0")
          setAutoStartState(false)
        }
      }
      return result.hasPro
    } finally {
      setProChecking(false)
    }
  }, [stop])

  const start = useCallback(async () => {
    setError(null)
    const allowed = await verifyProAccess()
    setHasPro(allowed.hasPro)
    if (!allowed.hasPro) {
      setError("PokeWatch requires CollecTools Pro. Sign in on the site, open PokeWatch once, then open native PokeWatch.")
      stop()
      return
    }
    try {
      await queueWatchService.start()
      await registerQueueBackgroundTask()
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG)
      setMonitoring(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start monitoring")
      setMonitoring(false)
    }
  }, [stop])

  const setAutoStart = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const allowed = await verifyProAccess()
        setHasPro(allowed.hasPro)
        if (!allowed.hasPro) {
          setError("Auto-start needs CollecTools Pro.")
          setAutoStartState(false)
          await AsyncStorage.setItem(AUTO_START_KEY, "0")
          return
        }
      }
      setAutoStartState(enabled)
      await AsyncStorage.setItem(AUTO_START_KEY, enabled ? "1" : "0")
    },
    [],
  )

  const applyWebViewReport = useCallback(
    async (report: WebViewReport) => {
      if (!hasPro) return
      setWebViewConnected(true)
      await queueWatchService.applyWebViewReport(report)
      void reportQueueStateToServer(report)
    },
    [hasPro],
  )

  useEffect(() => {
    void queueWatchService.init()

    const unsubscribe = queueWatchService.subscribe((next) => {
      setState(next)
      setMonitoring(queueWatchService.isActive())
      if (next.source === "webview") setWebViewConnected(true)
    })

    void (async () => {
      const allowed = await refreshProAccess()
      const value = await AsyncStorage.getItem(AUTO_START_KEY)
      const enabled = value !== "0"
      setAutoStartState(enabled)
      if (allowed && enabled) await start()
    })()

    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void refreshProAccess().then((allowed) => {
          if (allowed && queueWatchService.isActive()) {
            if (!queueWatchService.hasFreshWebView()) {
              void queueWatchService.runCheck()
            }
          }
        })
      }
    })

    return () => {
      unsubscribe()
      sub.remove()
    }
    // intentionally once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({
      monitoring,
      autoStart,
      state,
      error,
      webViewConnected,
      hasPro,
      proChecking,
      start,
      stop,
      setAutoStart,
      applyWebViewReport,
      refreshProAccess,
      setMonitorWebViewVisible,
    }),
    [
      monitoring,
      autoStart,
      state,
      error,
      webViewConnected,
      hasPro,
      proChecking,
      start,
      stop,
      setAutoStart,
      applyWebViewReport,
      refreshProAccess,
    ],
  )

  return (
    <QueueWatchContext.Provider value={value}>
      {monitoring && hasPro && !monitorWebViewVisible ? (
        <MonitorWebView visible={false} onReport={applyWebViewReport} />
      ) : null}
      {children}
    </QueueWatchContext.Provider>
  )
}

export function useQueueWatch() {
  const ctx = useContext(QueueWatchContext)
  if (!ctx) throw new Error("useQueueWatch must be used within QueueWatchProvider")
  return ctx
}
