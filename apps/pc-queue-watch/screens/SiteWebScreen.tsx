import { useCallback, useRef, useState } from "react"
import { ActivityIndicator, Linking, SafeAreaView, StyleSheet, View } from "react-native"
import { WebView } from "react-native-webview"
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes"
import { COLLECTOOLS_BASE_URL } from "../lib/config"
import { colors } from "../lib/theme"
import { BRIDGE_INJECT, saveQueueWatchCredentials } from "../lib/queue-watch/report-to-server"

function isCollecToolsUrl(url: string) {
  try {
    const base = new URL(COLLECTOOLS_BASE_URL)
    const target = new URL(url)
    return target.origin === base.origin
  } catch {
    return false
  }
}

export default function SiteWebScreen() {
  const [loading, setLoading] = useState(true)
  const webRef = useRef<WebView>(null)

  const onShouldStartLoadWithRequest = useCallback((request: ShouldStartLoadRequest) => {
    if (isCollecToolsUrl(request.url)) return true
    Linking.openURL(request.url).catch(() => {})
    return false
  }, [])

  const onMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string
        sessionId?: string
        token?: string
      }
      if (data?.type === "collectools-qw-creds") {
        void saveQueueWatchCredentials({
          sessionId: data.sessionId,
          token: data.token,
        })
      }
    } catch {
      // ignore
    }
  }, [])

  return (
    <SafeAreaView style={styles.safe}>
      <WebView
        ref={webRef}
        source={{ uri: COLLECTOOLS_BASE_URL }}
        style={styles.web}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => {
          setLoading(false)
          webRef.current?.injectJavaScript(BRIDGE_INJECT)
        }}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        originWhitelist={["https://*", "http://*"]}
        allowsBackForwardNavigationGestures
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
      />
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
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
    backgroundColor: colors.background,
  },
})
