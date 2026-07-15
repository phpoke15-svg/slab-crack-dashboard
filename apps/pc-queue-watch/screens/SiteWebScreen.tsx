import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"
import { WebView } from "react-native-webview"
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes"
import { COLLECTOOLS_BASE_URL, isCollectoolsHost } from "../lib/config"
import { colors } from "../lib/theme"
import { useQueueWatch } from "../lib/queue-watch"
import { BRIDGE_INJECT, saveQueueWatchCredentials } from "../lib/queue-watch/report-to-server"

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

export default function SiteWebScreen() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const webRef = useRef<WebView>(null)
  const canGoBackRef = useRef(false)
  const { refreshProAccess } = useQueueWatch()

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

  const onShouldStartLoadWithRequest = useCallback((request: ShouldStartLoadRequest) => {
    if (isAllowedInApp(request.url)) return true
    Linking.openURL(request.url).catch(() => {})
    setLoading(false)
    return false
  }, [])

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string
          sessionId?: string
          token?: string
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
    canGoBackRef.current = false
    setReloadKey((k) => k + 1)
  }, [])

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (canGoBackRef.current) {
          webRef.current?.goBack()
          return true
        }
        return false
      }
      const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack)
      return () => sub.remove()
    }, []),
  )

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <WebView
        key={reloadKey}
        ref={webRef}
        source={{ uri: `${COLLECTOOLS_BASE_URL}/pokewatch` }}
        style={styles.web}
        onLoadStart={() => {
          setLoadError(null)
          setLoading(true)
        }}
        onLoadEnd={finishLoading}
        onLoadProgress={({ nativeEvent }) => {
          if (nativeEvent.progress >= 0.9) setLoading(false)
        }}
        onNavigationStateChange={(nav) => {
          canGoBackRef.current = Boolean(nav.canGoBack)
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
