import { useEffect, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import * as WebBrowser from "expo-web-browser"
import { StatusBar } from "expo-status-bar"
import * as Notifications from "expo-notifications"
import {
  extractQueueUrl,
  FCM_TOPIC,
  registerForPushNotifications,
  subscribeToAlertsTopic,
} from "./lib/notifications"

export default function App() {
  const [status, setStatus] = useState("Requesting notification permissions…")
  const [loading, setLoading] = useState(true)
  const [lastOpenedUrl, setLastOpenedUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const token = await registerForPushNotifications()
        if (cancelled) return

        if (!token) {
          setStatus("Notification permission denied or unavailable on this device.")
          setLoading(false)
          return
        }

        await subscribeToAlertsTopic(token)
        if (cancelled) return

        setStatus(`Subscribed to ${FCM_TOPIC}. Waiting for queue alerts…`)
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : "Failed to subscribe"
        setStatus(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined
      const url = extractQueueUrl(data) ?? "https://www.pokemoncenter.com/"

      setLastOpenedUrl(url)
      void WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        enableBarCollapsing: true,
      })
    })

    return () => subscription.remove()
  }, [])

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>Pokémon Center Queue Alerts</Text>
      <Text style={styles.subtitle}>
        Opens queue links in Safari/Chrome (not an in-app WebView) so Imperva CAPTCHAs can pass.
      </Text>

      {loading ? <ActivityIndicator color="#60a5fa" style={styles.loader} /> : null}
      <Text style={styles.status}>{status}</Text>

      {lastOpenedUrl ? (
        <Pressable
          style={styles.button}
          onPress={() => void WebBrowser.openBrowserAsync(lastOpenedUrl)}
        >
          <Text style={styles.buttonText}>Re-open last queue link</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
    paddingHorizontal: 24,
    paddingTop: 72,
    gap: 16,
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 15,
    lineHeight: 22,
  },
  loader: {
    marginTop: 8,
  },
  status: {
    color: "#cbd5e1",
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
})
