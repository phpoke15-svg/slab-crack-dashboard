import { useCallback, useMemo, useRef } from "react"
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native"
import { WebView } from "react-native-webview"
import type { WebViewMessageEvent } from "react-native-webview"
import { POKEMON_CENTER_URL } from "../lib/config"
import { useQueueWatch } from "../lib/queue-watch"
import { WEBVIEW_MONITOR_SCRIPT } from "../lib/queue-watch/webview-monitor-script"

function formatRelativeTime(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

export default function QueueWatchScreen() {
  const {
    monitoring,
    autoStart,
    state,
    error,
    webViewConnected,
    start,
    stop,
    setAutoStart,
    applyWebViewReport,
  } = useQueueWatch()
  const webRef = useRef<WebView>(null)

  const statusLabel = useMemo(() => {
    if (state?.live) return "Queue is LIVE"
    if (!monitoring) return "Idle"
    if (state?.blocked) return "Pass the bot check"
    if (webViewConnected || state?.source === "webview") return "Monitoring…"
    return "Loading Pokemon Center…"
  }, [state?.live, state?.blocked, state?.source, monitoring, webViewConnected])

  const toggleMonitoring = () => {
    if (monitoring) stop()
    else void start()
  }

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string
          live?: boolean
          confidence?: number
          signals?: Array<{ id: string; label: string; confidence: number }>
          blocked?: boolean
          pageUrl?: string
          checkedAt?: string
        }
        if (data?.type !== "pc-queue-watch") return
        void applyWebViewReport({
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
    [applyWebViewReport],
  )

  const reinject = useCallback(() => {
    webRef.current?.injectJavaScript(WEBVIEW_MONITOR_SCRIPT)
  }, [])

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Native · Imperva-safe</Text>
        <Text style={styles.title}>Queue Watch</Text>
        <Text style={styles.subtitle}>
          Opens Pokemon Center in-app so you can pass Imperva, then watches Queue-it from that real
          browser session. Leave this tab open during drops.
        </Text>

        <View style={[styles.card, state?.live ? styles.cardLive : null]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Status</Text>
            {monitoring && !state?.live && <ActivityIndicator color="#4ade80" size="small" />}
          </View>
          <Text style={[styles.cardTitle, state?.live ? styles.cardTitleLive : null]}>
            {statusLabel}
          </Text>
          {state?.checkedAt && (
            <Text style={styles.meta}>
              Last ping {formatRelativeTime(state.checkedAt)}
              {state.source ? ` · via ${state.source}` : ""}
              {state.confidence > 0 ? ` · ${state.confidence}%` : ""}
            </Text>
          )}
          {monitoring && state?.blocked && (
            <Text style={styles.warn}>
              Imperva challenge is showing — complete it in the page below, then wait for the dark
              badge.
            </Text>
          )}
          {monitoring && !webViewConnected && !state?.blocked && (
            <Text style={styles.warn}>
              Waiting for the in-page monitor… if stuck, pull to refresh the page below.
            </Text>
          )}
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>Auto-start on launch</Text>
            <Text style={styles.hint}>Opens the Pokemon Center monitor when the app starts</Text>
          </View>
          <Switch value={autoStart} onValueChange={(v) => void setAutoStart(v)} />
        </View>

        <Pressable
          style={[styles.primaryButton, monitoring ? styles.stopButton : null]}
          onPress={toggleMonitoring}
        >
          <Text style={styles.primaryButtonText}>
            {monitoring ? "Stop monitoring" : "Start monitoring"}
          </Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      {monitoring ? (
        <View style={styles.webWrap}>
          <View style={styles.webBar}>
            <Text style={styles.webBarText}>pokemoncenter.com</Text>
            <Pressable onPress={reinject} hitSlop={8}>
              <Text style={styles.webBarAction}>Re-arm</Text>
            </Pressable>
          </View>
          <WebView
            ref={webRef}
            source={{ uri: POKEMON_CENTER_URL }}
            style={styles.web}
            onMessage={onMessage}
            injectedJavaScript={WEBVIEW_MONITOR_SCRIPT}
            onLoadEnd={reinject}
            originWhitelist={["https://*", "http://*"]}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures
          />
        </View>
      ) : (
        <View style={styles.idleHint}>
          <Text style={styles.footer}>
            Start monitoring to load Pokemon Center here. Pass any bot check once, keep the app on
            this tab, and you&apos;ll get a push when the queue goes live.
          </Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0e14" },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10 },
  kicker: { color: "#86efac", fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  title: { color: "#f9fafb", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 13, lineHeight: 18 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#111827",
    padding: 12,
    gap: 4,
  },
  cardLive: { borderColor: "#34d399", backgroundColor: "rgba(6, 78, 59, 0.35)" },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLabel: { color: "#9ca3af", fontSize: 11, textTransform: "uppercase", fontWeight: "600" },
  cardTitle: { color: "#f9fafb", fontSize: 18, fontWeight: "700" },
  cardTitleLive: { color: "#6ee7b7" },
  meta: { color: "#9ca3af", fontSize: 11 },
  warn: { color: "#fbbf24", fontSize: 12, marginTop: 4, lineHeight: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowText: { flex: 1 },
  label: { color: "#e5e7eb", fontSize: 13, fontWeight: "600" },
  hint: { color: "#6b7280", fontSize: 11, marginTop: 2 },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: "#16a34a",
    paddingVertical: 12,
    alignItems: "center",
  },
  stopButton: { backgroundColor: "#b91c1c" },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  error: { color: "#f87171", fontSize: 12 },
  webWrap: { flex: 1, borderTopWidth: 1, borderTopColor: "#1f2937" },
  webBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#111827",
  },
  webBarText: { color: "#9ca3af", fontSize: 12, fontWeight: "600" },
  webBarAction: { color: "#4ade80", fontSize: 12, fontWeight: "700" },
  web: { flex: 1, backgroundColor: "#0b0e14" },
  idleHint: { paddingHorizontal: 16, paddingTop: 8 },
  footer: { color: "#6b7280", fontSize: 12, lineHeight: 18 },
})
