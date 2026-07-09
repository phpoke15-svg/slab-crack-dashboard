import { useMemo } from "react"
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from "react-native"
import { WebView } from "react-native-webview"
import type { RouteProp } from "@react-navigation/native"
import { useRoute } from "@react-navigation/native"
import { COLLECTOOLS_BASE_URL } from "../lib/config"
import type { ToolsStackParamList } from "../lib/navigation"

export default function ToolWebScreen() {
  const route = useRoute<RouteProp<ToolsStackParamList, "Tool">>()
  const uri = useMemo(() => {
    const path = route.params?.path || "/"
    return `${COLLECTOOLS_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`
  }, [route.params?.path])

  return (
    <SafeAreaView style={styles.safe}>
      <WebView
        source={{ uri }}
        style={styles.web}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color="#60a5fa" size="large" />
          </View>
        )}
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0e14" },
  web: { flex: 1, backgroundColor: "#0b0e14" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b0e14" },
})
