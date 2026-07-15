import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { verifyProAccess } from "./pro-access"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

type QueueWatchContextValue = {
  hasPro: boolean | null
  proChecking: boolean
  refreshProAccess: () => Promise<boolean>
}

const QueueWatchContext = createContext<QueueWatchContextValue | null>(null)

export function QueueWatchProvider({ children }: { children: ReactNode }) {
  const [hasPro, setHasPro] = useState<boolean | null>(null)
  const [proChecking, setProChecking] = useState(true)

  const refreshProAccess = useCallback(async () => {
    setProChecking(true)
    try {
      const result = await verifyProAccess()
      setHasPro(result.hasPro)
      return result.hasPro
    } finally {
      setProChecking(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("queue-live", {
          name: "Pokemon Center queue alerts",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 300, 150, 300],
          sound: "default",
        })
      }
      const current = await Notifications.getPermissionsAsync()
      if (current.status !== "granted") {
        await Notifications.requestPermissionsAsync()
      }
      await refreshProAccess()
    })()
  }, [refreshProAccess])

  const value = useMemo(
    () => ({ hasPro, proChecking, refreshProAccess }),
    [hasPro, proChecking, refreshProAccess],
  )

  return <QueueWatchContext.Provider value={value}>{children}</QueueWatchContext.Provider>
}

export function useQueueWatch() {
  const ctx = useContext(QueueWatchContext)
  if (!ctx) throw new Error("useQueueWatch must be used within QueueWatchProvider")
  return ctx
}
