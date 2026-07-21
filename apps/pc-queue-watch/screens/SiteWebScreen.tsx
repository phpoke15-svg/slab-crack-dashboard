import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RouteProp } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"
import { WebView } from "react-native-webview"
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes"
import { COLLECTOOLS_BASE_URL, isCollectoolsHost } from "../lib/config"
import type { RootStackParamList } from "../lib/navigation"
import { colors } from "../lib/theme"
import { useQueueWatch } from "../lib/queue-watch"
import { NATIVE_APP_SHELL_INJECT } from "../lib/native-webview-shell"
import { BRIDGE_INJECT, saveQueueWatchCredentials } from "../lib/queue-watch/report-to-server"
import { useAppExitGuard } from "../lib/use-app-exit-guard"

function isAllowedInApp(url: string) {
  if (!url || url === "about:blank") return true
  try {
    const target = new URL(url)
    if (target.protocol !== "http:" && target.protocol !== "https:") return true
    if (isCollectoolsHost(target.hostname)) return true
    return false
  } catch {
    return true
  }
}

function scanToolFromUrl(url: string): "slabcrack" | "slablab" | null {
  try {
    const path = new URL(url).pathname
    if (
      path.includes("/slablabs/slabit/scan") ||
      path.includes("/slabit/scan") ||
      path.includes("/slablab/scan")
    ) {
      return "slablab"
    }
    if (path.includes("/slablabs/slabcrack/scan") || path.includes("/slabcrack/scan")) {
      return "slabcrack"
    }
  } catch {
    return null
  }
  return null
}

function isExternalPaymentUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host.includes("stripe.com") || host.includes("billing.stripe.com")
  } catch {
    return false
  }
}

export default function SiteWebScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, "Home">>()
  const initialPath = route.params?.initialPath ?? "/"
  const startUrl = `${COLLECTOOLS_BASE_URL}${initialPath.startsWith("/") ? initialPath : `/${initialPath}`}`

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [contentCanGoBack, setContentCanGoBack] = useState(false)
  const webRef = useRef<WebView>(null)
  const { refreshProAccess } = useQueueWatch()

  const webGoBack = useCallback(() => {
    webRef.current?.goBack()
  }, [])

  useAppExitGuard({ contentCanGoBack, onContentGoBack: webGoBack })

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setLoading(false), 10_000)
    return () => clearTimeout(timer)
  }, [loading, reloadKey])

  const injectHelpers = useCallback(() => {
    webRef.current?.injectJavaScript(BRIDGE_INJECT)
  }, [])

  const finishLoading = useCallback(() => {
    setLoading(false)
    injectHelpers()
  }, [injectHelpers])

  const onShouldStartLoadWithRequest = useCallback(
    (request: ShouldStartLoadRequest) => {
      const scanTool = scanToolFromUrl(request.url)
      if (scanTool) {
        navigation.navigate("PointScan", { tool: scanTool })
        return false
      }

      if (isExternalPaymentUrl(request.url)) {
        Alert.alert(
          "Subscribe in the App Store",
          "CollecTools subscriptions on iPhone use Apple In-App Purchase. Return to Pricing in the app and tap a plan.",
        )
        return false
      }

      if (isAllowedInApp(request.url)) return true
      Linking.openURL(request.url).catch(() => {})
      setLoading(false)
      return false
    },
    [navigation],
  )

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string
          sessionId?: string
          token?: string
        }
        if (data?.type === "collectools-iap-purchase") {
          Alert.alert(
            "In-App Purchase required",
            "Create Premium/Pro subscription products in App Store Connect, then wire StoreKit in the native shell before resubmitting.",
          )
          return
        }
        if (data?.type === "open-native-queue") {
          navigation.navigate("PokeWatch")
          return
        }
        if (data?.type === "collectools-qw-creds") {
          void saveQueueWatchCredentials({
            sessionId: data.sessionId,
            token: data.token ?? "",
          }).then(({ tokenChanged }) => {
            if (tokenChanged) void refreshProAccess()
          })
        }
      } catch {
        // ignore
      }
    },
    [refreshProAccess],
  )

  const retry = useCallback(() => {
    setLoadError(null)
    setLoading(true)
    setContentCanGoBack(false)
    setReloadKey((k) => k + 1)
  }, [])

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <WebView
        key={`${reloadKey}-${startUrl}`}
        ref={webRef}
        source={{ uri: startUrl }}
        style={styles.web}
        injectedJavaScriptBeforeContentLoaded={NATIVE_APP_SHELL_INJECT}
        mediaCapturePermissionGrantType="grant"
        onLoadStart={() => {
          setLoadError(null)
          setLoading(true)
        }}
        onLoadEnd={finishLoading}
        onLoadProgress={({ nativeEvent }) => {
          if (nativeEvent.progress >= 0.9) setLoading(false)
        }}
        onNavigationStateChange={(nav) => {
          setContentCanGoBack(Boolean(nav.canGoBack))
          setTimeout(injectHelpers, 400)
        }}
        onError={(event) => {
          setLoading(false)
          setLoadError(event.nativeEvent.description || "Could not load CollecTools")
        }}
        onHttpError={() => {
          setLoading(false)
        }}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        originWhitelist={["https://*", "http://*", "about:blank"]}
        allowsBackForwardNavigationGestures
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
      />
      {loading && !loadError && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading CollecTools…</Text>
        </View>
      )}
      {loadError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>Couldn’t load the site</Text>
          <Text style={styles.errorBody}>{loadError}</Text>
          <Pressable style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  web: { flex: 1, backgroundColor: colors.background },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "rgba(11, 14, 20, 0.72)",
  },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
    backgroundColor: colors.background,
  },
  errorTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  errorBody: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  retryButton: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: colors.primaryStrong,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryText: { color: colors.white, fontWeight: "700", fontSize: 14 },
})
