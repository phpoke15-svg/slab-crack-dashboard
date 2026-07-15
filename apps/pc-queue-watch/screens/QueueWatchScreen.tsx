import { useCallback, useMemo, useRef } from "react"
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native"
import * as Linking from "expo-linking"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { SafeAreaView } from "react-native-safe-area-context"
import { WebView } from "react-native-webview"
import type { WebViewMessageEvent } from "react-native-webview"
import { COLLECTOOLS_BASE_URL, POKEMON_CENTER_URL } from "../lib/config"
import type { RootStackParamList } from "../lib/navigation"
import { colors } from "../lib/theme"
import { useQueueWatch } from "../lib/queue-watch"
import { WEBVIEW_MONITOR_SCRIPT } from "../lib/queue-watch/webview-monitor-script"

function formatRelativeTime(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

export default function QueueWatchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const {
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
  } = useQueueWatch()
  const webRef = useRef<WebView>(null)
  const pcCanGoBackRef = useRef(false)

  const statusLabel = useMemo(() => {
    if (state?.live) return "Queue is LIVE"
    if (!monitoring) return "Idle"
    const challenge =
      state?.signals?.some((s) => /imperva|captcha/i.test(s.id)) ?? false
    if (challenge || state?.blocked) return "Drop guard — pass verification"
    if (webViewConnected || state?.source === "webview") return "Monitoring…"
    return "Loading Pokemon Center…"
  }, [state?.live, state?.blocked, state?.source, state?.signals, monitoring, webViewConnected])

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
          challenge?: boolean
          pageUrl?: string
          checkedAt?: string
        }
        if (data?.type !== "pc-queue-watch") return
        void applyWebViewReport({
          live: Boolean(data.live),
          confidence: typeof data.confidence === "number" ? data.confidence : 0,
          signals: data.signals,
          blocked: Boolean(data.blocked),
          challenge: Boolean(data.challenge),
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

  const openHome = useCallback(() => {
    navigation.navigate("Home")
  }, [navigation])

  const openPricing = useCallback(() => {
    navigation.navigate("Home")
    void Linking.openURL(`${COLLECTOOLS_BASE_URL}/pricing`)
  }, [navigation])

  // Prefer Pokemon Center WebView history, then pop back to Home — never exit the app from Queue.
  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (monitoring && pcCanGoBackRef.current) {
          webRef.current?.goBack()
          return true
        }
        if (navigation.canGoBack()) {
          navigation.goBack()
          return true
        }
        navigation.navigate("Home")
        return true
      }
      const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack)
      return () => sub.remove()
    }, [monitoring, navigation]),
  )

  if (proChecking && hasPro === null) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <View style={styles.lockWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.lockMeta}>Checking Pro access…</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!hasPro) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Pro only</Text>
          <Text style={styles.title}>PokeWatch</Text>
          <Text style={styles.subtitle}>
            Native Pokémon Center monitoring and alerts are included with CollecTools Pro.
          </Text>

          <View style={styles.lockCard}>
            <Text style={styles.lockTitle}>Unlock with Pro</Text>
            <Text style={styles.lockBody}>
              1. Go back to CollecTools and sign in{"\n"}
              2. Upgrade to Pro if needed{"\n"}
              3. Open PokeWatch on the site (links your Pro token){"\n"}
              4. Tap “Open native PokeWatch”, then Refresh access here
            </Text>
          </View>

          <Pressable style={styles.primaryButton} onPress={openHome}>
            <Text style={styles.primaryButtonText}>Back to CollecTools</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={openPricing}>
            <Text style={styles.secondaryButtonText}>View Pro pricing</Text>
          </Pressable>
          <Pressable
            style={styles.ghostButton}
            onPress={() => void refreshProAccess()}
            disabled={proChecking}
          >
            <Text style={styles.ghostButtonText}>
              {proChecking ? "Checking…" : "Refresh access"}
            </Text>
          </Pressable>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Native · Imperva-safe · Pro</Text>
        <Text style={styles.title}>PokeWatch</Text>
        <Text style={styles.subtitle}>
          Opens Pokemon Center in-app so you can pass Imperva, then watches Queue-it from that real
          browser session. Leave this screen open during drops.
        </Text>

        <View style={[styles.card, state?.live ? styles.cardLive : null]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Status</Text>
            {monitoring && !state?.live && <ActivityIndicator color={colors.primary} size="small" />}
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
          <Switch
            value={autoStart}
            onValueChange={(v) => void setAutoStart(v)}
            trackColor={{ false: colors.border, true: colors.primaryStrong }}
            thumbColor={colors.white}
            ios_backgroundColor={colors.border}
          />
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
            onNavigationStateChange={(nav) => {
              pcCanGoBackRef.current = Boolean(nav.canGoBack)
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
      ) : (
        <View style={styles.idleHint}>
          <Text style={styles.footer}>
            Start monitoring to load Pokemon Center here. Pass any bot check once, keep this screen
            open, and you&apos;ll get a push when the queue goes live.
          </Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10 },
  kicker: { color: colors.primary, fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
    gap: 4,
  },
  cardLive: { borderColor: colors.live, backgroundColor: colors.liveBg },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLabel: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase", fontWeight: "600" },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  cardTitleLive: { color: colors.liveSoft },
  meta: { color: colors.textMuted, fontSize: 11 },
  warn: { color: colors.warn, fontSize: 12, marginTop: 4, lineHeight: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowText: { flex: 1 },
  label: { color: "#e5e7eb", fontSize: 13, fontWeight: "600" },
  hint: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: colors.primaryStrong,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  ghostButton: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  ghostButtonText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  stopButton: { backgroundColor: colors.danger },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  error: { color: colors.error, fontSize: 12 },
  webWrap: { flex: 1, borderTopWidth: 1, borderTopColor: colors.border },
  webBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  webBarText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  webBarAction: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  web: { flex: 1, backgroundColor: colors.background },
  idleHint: { paddingHorizontal: 16, paddingTop: 8 },
  footer: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  lockWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  lockMeta: { color: colors.textMuted, fontSize: 13 },
  lockCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 8,
  },
  lockTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  lockBody: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
})
