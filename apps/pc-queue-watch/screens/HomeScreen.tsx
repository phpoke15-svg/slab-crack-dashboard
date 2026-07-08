import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs"
import { COLLECTOOLS_BASE_URL, TOOLS } from "../lib/config"
import { useQueueWatch } from "../lib/queue-watch"
import type { RootTabParamList } from "../App"

type Nav = BottomTabNavigationProp<RootTabParamList>

export default function HomeScreen() {
  const navigation = useNavigation<Nav>()
  const { state, monitoring } = useQueueWatch()

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.brand}>CollecTools</Text>
        <Text style={styles.subtitle}>TCG collector toolkit on your phone</Text>

        <Pressable style={[styles.hero, state?.live ? styles.heroLive : null]} onPress={() => navigation.navigate("Queue")}>
          <Text style={styles.heroKicker}>Native · Queue Watch</Text>
          <Text style={styles.heroTitle}>{state?.live ? "Queue is LIVE" : monitoring ? "Monitoring active" : "Queue Watch"}</Text>
          <Text style={styles.heroBody}>
            {state?.live
              ? "Pokemon Center virtual queue detected. Tap to open Queue Watch or join now."
              : "Instant push when Pokemon Center's queue goes live. Runs on your phone — no browser tab needed."}
          </Text>
          <Text style={styles.heroCta}>{state?.live ? "View queue status →" : "Open Queue Watch →"}</Text>
        </Pressable>

        <Text style={styles.section}>Web tools</Text>
        {TOOLS.map((tool) => (
          <Pressable
            key={tool.id}
            style={styles.card}
            onPress={() =>
              navigation.navigate("Tools", {
                screen: "Tool",
                params: { path: tool.path, name: tool.name },
              } as never)
            }
          >
            <View>
              <Text style={styles.cardTitle}>{tool.name}</Text>
              <Text style={styles.cardMeta}>{tool.tagline}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}

        <Text style={styles.footer}>Connected to {COLLECTOOLS_BASE_URL.replace(/^https?:\/\//, "")}</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0e14" },
  container: { padding: 20, gap: 12, paddingBottom: 40 },
  brand: { color: "#f9fafb", fontSize: 30, fontWeight: "800" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginBottom: 8 },
  hero: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2563eb",
    backgroundColor: "rgba(37, 99, 235, 0.15)",
    padding: 18,
    gap: 6,
  },
  heroLive: {
    borderColor: "#34d399",
    backgroundColor: "rgba(6, 78, 59, 0.35)",
  },
  heroKicker: { color: "#93c5fd", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  heroTitle: { color: "#f9fafb", fontSize: 22, fontWeight: "800" },
  heroBody: { color: "#d1d5db", fontSize: 14, lineHeight: 20 },
  heroCta: { color: "#93c5fd", fontSize: 14, fontWeight: "700", marginTop: 6 },
  section: { color: "#9ca3af", fontSize: 12, fontWeight: "700", textTransform: "uppercase", marginTop: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#111827",
    padding: 16,
  },
  cardTitle: { color: "#f9fafb", fontSize: 16, fontWeight: "700" },
  cardMeta: { color: "#9ca3af", fontSize: 12, marginTop: 2 },
  chevron: { color: "#6b7280", fontSize: 24, fontWeight: "300" },
  footer: { color: "#4b5563", fontSize: 11, marginTop: 12, textAlign: "center" },
})
