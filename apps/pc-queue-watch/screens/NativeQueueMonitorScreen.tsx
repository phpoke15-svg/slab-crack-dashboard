import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { SafeAreaView } from "react-native-safe-area-context"
import { WebView } from "react-native-webview"
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes"
import * as Notifications from "expo-notifications"
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake"
import { POKEMON_CENTER_URL, isPokemonCenterHost } from "../lib/config"
import type { RootStackParamList } from "../lib/navigation"
import { colors } from "../lib/theme"
import { useQueueWatch } from "../lib/queue-watch"
import { loadStoredCredentials } from "../lib/queue-watch/credentials"
import { NATIVE_MONITOR_INJECT } from "../lib/queue-watch/native-monitor-inject"
import { reportNativeScan, type NativeScanPayload } from "../lib/queue-watch/report-from-native"

const KEEP_AWAKE_TAG = "pokewatch-native-monitor"
const REPORT_MIN_GAP_MS = 8_000

function isAllowedMonitorUrl(url: string): boolean {
  if (!url || url === "about:blank") return true
  try {
    const target = new URL(url)
    if (target.protocol !== "http:" && target.protocol !== "https:") return false
    return isPokemonCenterHost(target.hostname)
  } catch {
    return false
  }
}

export default function NativeQueueMonitorScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { hasPro, proChecking, refreshProAccess } = useQueueWatch()
  const webRef = useRef<WebView>(null)
  const previousLiveRef = useRef(false)
  const lastReportAtRef = useRef(0)

  const [sessionId, setSessionId] = useState("")
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [monitoring, setMonitoring] = useState(true)
  const [live, setLive] = useState(false)
  const [challenge, setChallenge] = useState(false)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)

  const reloadCredentials = useCallback(async () => {
    const creds = await loadStoredCredentials()
    setSessionId(creds.sessionId)
    setToken(creds.token)
    return creds
  }, [])

  useFocusEffect(
    useCallback(() => {
      void reloadCredentials()
      void refreshProAccess()
    }, [reloadCredentials, refreshProAccess]),
  )

  useEffect(() => {
    if (monitoring) {
      void activateKeepAwakeAsync(KEEP_AWAKE_TAG)
      return () => {
        void deactivateKeepAwake(KEEP_AWAKE_TAG)
      }
    }
    void deactivateKeepAwake(KEEP_AWAKE_TAG)
    return undefined
  }, [monitoring])

  const notifyLive = useCallback(async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Pokemon Center queue is LIVE",
        body: "You're in the in-app monitor — join the queue now.",
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    })
  }, [])

  const handleScan = useCallback(
    async (scan: NativeScanPayload) => {
      setLive(scan.live)
      setChallenge(Boolean(scan.challenge))

      if (scan.live && !previousLiveRef.current) {
        void notifyLive()
      }
      previousLiveRef.current = scan.live

      if (!monitoring || !sessionId || !token) return

      const now = Date.now()
      const forceReport = scan.live || scan.challenge
      if (!forceReport && now - lastReportAtRef.current < REPORT_MIN_GAP_MS) return

      const result = await reportNativeScan({ sessionId, token, scan })
      if (result.ok) {
        lastReportAtRef.current = now
        setSyncedAt(new Date().toISOString())
        setReportError(null)
        return
      }

      if (result.status === 403 || result.status === 401) {
        setReportError(result.error || "Pro subscription required.")
        setMonitoring(false)
        return
      }

      setReportError(result.error || "Could not sync with CollecTools")
    },
    [monitoring, notifyLive, sessionId, token],
  )

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string
          live?: boolean
          confidence?: number
          signals?: NativeScanPayload["signals"]
          pageUrl?: string
          challenge?: boolean
        }
        if (data?.type !== "pc-native-scan") return
        void handleScan({
          live: Boolean(data.live),
          confidence: typeof data.confidence === "number" ? data.confidence : 0,
          signals: Array.isArray(data.signals) ? data.signals : [],
          pageUrl: data.pageUrl,
          challenge: data.challenge,
        })
      } catch {
        // ignore malformed bridge messages
      }
    },
    [handleScan],
  )

  const reinjectScanner = useCallback(() => {
    webRef.current?.injectJavaScript(NATIVE_MONITOR_INJECT)
  }, [])

  if (proChecking && hasPro === null) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.muted}>Checking Pro access…</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!hasPro || !token) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.lockWrap}>
          <Text style={styles.title}>Pro required</Text>
          <Text style={styles.subtitle}>
            Sign in on CollecTools with Pro, open PokeWatch once to link your token, then return
            here.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate("Home", { initialPath: "/pokewatch" })}>
            <Text style={styles.primaryButtonText}>Open CollecTools PokeWatch</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => void refreshProAccess().then(() => reloadCredentials())}>
            <Text style={styles.secondaryButtonText}>Refresh access</Text>
          </Pressable>
          <Pressable style={styles.ghostButton} onPress={() => navigation.goBack()}>
            <Text style={styles.ghostButtonText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.toolbar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <View style={styles.toolbarCenter}>
          <Text style={styles.toolbarTitle}>Native PokeWatch</Text>
          <Text style={[styles.toolbarStatus, live ? styles.liveText : null]}>
            {live ? "Queue LIVE" : challenge ? "Complete verification" : monitoring ? "Monitoring" : "Paused"}
          </Text>
        </View>
        <Pressable onPress={() => setMonitoring((value) => !value)} hitSlop={8}>
          <Text style={styles.toggle}>{monitoring ? "Pause" : "Resume"}</Text>
        </Pressable>
      </View>

      {reportError ? <Text style={styles.warn}>{reportError}</Text> : null}
      {syncedAt ? (
        <Text style={styles.meta}>Synced {new Date(syncedAt).toLocaleTimeString()}</Text>
      ) : null}

      <WebView
        ref={webRef}
        source={{ uri: POKEMON_CENTER_URL }}
        style={styles.web}
        onLoadStart={() => {
          setLoadError(null)
          setLoading(true)
        }}
        onLoadEnd={() => {
          setLoading(false)
          setTimeout(reinjectScanner, 500)
        }}
        onError={(event) => {
          setLoading(false)
          setLoadError(event.nativeEvent.description || "Could not load Pokemon Center")
        }}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={(request: ShouldStartLoadRequest) => isAllowedMonitorUrl(request.url)}
        injectedJavaScript={NATIVE_MONITOR_INJECT}
        originWhitelist={["https://*", "http://*"]}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
      />

      {loading && !loadError ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.muted}>Loading Pokemon Center…</Text>
        </View>
      ) : null}

      {loadError ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>Could not load Pokemon Center</Text>
          <Text style={styles.errorBody}>{loadError}</Text>
          <Pressable style={styles.primaryButton} onPress={() => webRef.current?.reload()}>
            <Text style={styles.primaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.footer}>
        Keep this screen open during drops. Complete any Imperva check once. Your token stays in the
        app — never injected into the Pokemon Center page.
      </Text>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  lockWrap: { flex: 1, padding: 20, justifyContent: "center", gap: 12 },
  muted: { color: colors.textMuted, fontSize: 13 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  back: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  toggle: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  toolbarCenter: { alignItems: "center", flex: 1 },
  toolbarTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
  toolbarStatus: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  liveText: { color: colors.liveSoft, fontWeight: "700" },
  warn: { color: colors.warn, fontSize: 12, paddingHorizontal: 12, paddingTop: 8 },
  meta: { color: colors.textDim, fontSize: 11, paddingHorizontal: 12, paddingTop: 4 },
  web: { flex: 1, backgroundColor: colors.background },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 88,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(11, 14, 20, 0.72)",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 88,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
    backgroundColor: colors.background,
  },
  errorTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  errorBody: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  footer: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: colors.primaryStrong,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: "700" },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  ghostButton: { paddingVertical: 10, alignItems: "center" },
  ghostButtonText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
})
