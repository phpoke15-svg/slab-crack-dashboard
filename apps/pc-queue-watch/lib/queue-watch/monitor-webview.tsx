import { useCallback, useRef } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { WebView } from "react-native-webview"
import type { WebViewMessageEvent } from "react-native-webview"
import { POKEMON_CENTER_URL } from "../config"
import {
  QUEUE_MONITOR_EARLY_SCRIPT,
  WEBVIEW_MONITOR_SCRIPT,
} from "./webview-monitor-script"
import type { WebViewReport } from "./service"

type Props = {
  visible: boolean
  onReport: (report: WebViewReport) => void
  style?: StyleProp<ViewStyle>
}

/**
 * Persistent Pokemon Center WebView for queue monitoring.
 * Stays mounted while monitoring is on — even when the user navigates to Home —
 * so client-side Queue-it activation is not missed.
 */
export function MonitorWebView({ visible, onReport, style }: Props) {
  const webRef = useRef<WebView>(null)

  const reinject = useCallback(() => {
    webRef.current?.injectJavaScript(WEBVIEW_MONITOR_SCRIPT)
  }, [])

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string
          live?: boolean
          confidence?: number
          signals?: WebViewReport["signals"]
          blocked?: boolean
          pageUrl?: string
          checkedAt?: string
        }
        if (data?.type !== "pc-queue-watch") return
        onReport({
          live: Boolean(data.live),
          confidence: typeof data.confidence === "number" ? data.confidence : 0,
          signals: data.signals,
          blocked: Boolean(data.blocked),
          pageUrl: data.pageUrl,
          checkedAt: data.checkedAt,
        })
      } catch {
        // ignore malformed messages
      }
    },
    [onReport],
  )

  return (
    <View
      style={[visible ? styles.visible : styles.hidden, style]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <WebView
        ref={webRef}
        source={{ uri: POKEMON_CENTER_URL }}
        style={styles.web}
        onMessage={onMessage}
        injectedJavaScriptBeforeContentLoaded={QUEUE_MONITOR_EARLY_SCRIPT}
        injectedJavaScript={WEBVIEW_MONITOR_SCRIPT}
        onLoadEnd={reinject}
        onNavigationStateChange={() => {
          reinject()
        }}
        originWhitelist={["https://*", "http://*"]}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
      />
    </View>
  )
}

const styles = StyleSheet.create({
  visible: { flex: 1 },
  hidden: {
    position: "absolute",
    left: -10_000,
    top: 0,
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
  },
  web: { flex: 1, backgroundColor: "#0b0e14" },
})
