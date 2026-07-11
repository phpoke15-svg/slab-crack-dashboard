import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { WebView } from "react-native-webview"
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes"
import { COLLECTOOLS_BASE_URL } from "../lib/config"
import type { RootStackParamList } from "../lib/navigation"
import { colors } from "../lib/theme"
import { useQueueWatch } from "../lib/queue-watch"
import { BRIDGE_INJECT, saveQueueWatchCredentials } from "../lib/queue-watch/report-to-server"

/** Floating CTA on /queue-watch so native monitoring is reached from the site, not a tab. */
const NATIVE_QUEUE_CTA_INJECT = `
(function(){
  try {
    if (!window.ReactNativeWebView) return;
    var path = (location.pathname || '');
    if (path.indexOf('/queue-watch') !== 0) {
      var old = document.getElementById('ct-native-qw-cta');
      if (old) old.remove();
      return;
    }
    if (document.getElementById('ct-native-qw-cta')) return;
    var b = document.createElement('button');
    b.id = 'ct-native-qw-cta';
    b.type = 'button';
    b.textContent = 'Open native Queue Watch';
    b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:16px;z-index:2147483646;padding:14px 16px;border:0;border-radius:14px;background:#16a34a;color:#fff;font:700 15px/1.2 system-ui,sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.4);cursor:pointer;';
    b.onclick = function(){
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'open-native-queue' }));
    };
    document.documentElement.appendChild(b);
  } catch (e) {}
  true;
})();
`

function isAllowedInApp(url: string) {
  if (!url || url === "about:blank") return true
  try {
    const target = new URL(url)
    if (target.protocol !== "http:" && target.protocol !== "https:") return true
    const base = new URL(COLLECTOOLS_BASE_URL)
    if (target.origin === base.origin) return true
    const host = target.hostname.toLowerCase()
    if (host.endsWith(".supabase.co")) return true
    if (host === "supabase.co") return true
    return false
  } catch {
    return true
  }
}

function isQueueWatchPath(url: string) {
  try {
    const path = new URL(url).pathname
    return path === "/queue-watch" || path.startsWith("/queue-watch/")
  } catch {
    return false
  }
}

export default function SiteWebScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const webRef = useRef<WebView>(null)
  const { refreshProAccess } = useQueueWatch()

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setLoading(false), 10_000)
    return () => clearTimeout(timer)
  }, [loading, reloadKey])

  const injectHelpers = useCallback(() => {
    webRef.current?.injectJavaScript(BRIDGE_INJECT)
    webRef.current?.injectJavaScript(NATIVE_QUEUE_CTA_INJECT)
  }, [])

  const finishLoading = useCallback(() => {
    setLoading(false)
    injectHelpers()
  }, [injectHelpers])

  const openNativeQueue = useCallback(() => {
    navigation.navigate("Queue")
  }, [navigation])

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
        if (data?.type === "open-native-queue") {
          openNativeQueue()
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
    [openNativeQueue, refreshProAccess],
  )

  const retry = useCallback(() => {
    setLoadError(null)
    setLoading(true)
    setReloadKey((k) => k + 1)
  }, [])

  return (
    <SafeAreaView style={styles.safe}>
      <WebView
        key={reloadKey}
        ref={webRef}
        source={{ uri: COLLECTOOLS_BASE_URL }}
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
          if (isQueueWatchPath(nav.url)) {
            // Re-inject CTA after client-side navigations (Next.js).
            setTimeout(injectHelpers, 400)
          }
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
        startInLoadingState={false}
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
          <Text style={styles.errorHint}>{COLLECTOOLS_BASE_URL}</Text>
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
  errorHint: { color: colors.textDim, fontSize: 11, textAlign: "center", marginTop: 4 },
  retryButton: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: colors.primaryStrong,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryText: { color: colors.white, fontWeight: "700", fontSize: 14 },
})
