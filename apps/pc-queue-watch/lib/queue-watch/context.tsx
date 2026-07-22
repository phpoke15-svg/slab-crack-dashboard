import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  isNativePushRegistered,
  registerNativeQueueAlerts,
} from "../push/remote-alerts"
import { verifyProAccess } from "./pro-access"

type QueueWatchContextValue = {
  hasPro: boolean | null
  proChecking: boolean
  nativePushEnabled: boolean
  refreshProAccess: () => Promise<boolean>
  registerNativePush: () => Promise<{ ok: true } | { ok: false; error: string }>
}

const QueueWatchContext = createContext<QueueWatchContextValue | null>(null)

export function QueueWatchProvider({ children }: { children: ReactNode }) {
  const [hasPro, setHasPro] = useState<boolean | null>(null)
  const [proChecking, setProChecking] = useState(true)
  const [nativePushEnabled, setNativePushEnabled] = useState(false)

  const refreshNativePushState = useCallback(async () => {
    setNativePushEnabled(await isNativePushRegistered())
  }, [])

  const registerNativePush = useCallback(async () => {
    const result = await registerNativeQueueAlerts()
    if (result.ok) {
      setNativePushEnabled(true)
    }
    return result
  }, [])

  const refreshProAccess = useCallback(async () => {
    setProChecking(true)
    try {
      const result = await verifyProAccess()
      setHasPro(result.hasPro)
      if (result.hasPro) {
        const push = await registerNativeQueueAlerts()
        if (push.ok) {
          setNativePushEnabled(true)
        }
      }
      return result.hasPro
    } finally {
      setProChecking(false)
    }
  }, [])

  useEffect(() => {
    void refreshNativePushState()
    void refreshProAccess()
  }, [refreshNativePushState, refreshProAccess])

  const value = useMemo(
    () => ({
      hasPro,
      proChecking,
      nativePushEnabled,
      refreshProAccess,
      registerNativePush,
    }),
    [hasPro, proChecking, nativePushEnabled, refreshProAccess, registerNativePush],
  )

  return <QueueWatchContext.Provider value={value}>{children}</QueueWatchContext.Provider>
}

export function useQueueWatch() {
  const ctx = useContext(QueueWatchContext)
  if (!ctx) throw new Error("useQueueWatch must be used within QueueWatchProvider")
  return ctx
}
