import { useCallback, useState } from "react"
import { ActivityIndicator, Linking, SafeAreaView, StyleSheet, View } from "react-native"
import { WebView } from "react-native-webview"
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes"
import { COLLECTOOLS_BASE_URL } from "../lib/config"

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

  const onShouldStartLoadWithRequest = useCallback((request: ShouldStartLoadRequest) => {
    if (isCollecToolsUrl(request.url)) return true
    Linking.openURL(request.url).catch(() => {})
    return false
  }, [])

  return (
    <SafeAreaView style={styles.safe}>
      <WebView
        source={{ uri: COLLECTOOLS_BASE_URL }}
        style={styles.web}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        originWhitelist={["https://*", "http://*"]}
        allowsBackForwardNavigationGestures
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
      />
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color="#60a5fa" size="large" />
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0e14" },
  web: { flex: 1, backgroundColor: "#0b0e14" },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b0e14",
  },
})
