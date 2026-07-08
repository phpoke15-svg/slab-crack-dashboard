import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { TOOLS } from "../lib/config"

import type { ToolsStackParamList } from "../lib/navigation"

type Nav = NativeStackNavigationProp<ToolsStackParamList>

export default function ToolsHomeScreen() {
  const navigation = useNavigation<Nav>()

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Tools</Text>
        <Text style={styles.subtitle}>Opens your live CollecTools site inside the app</Text>

        {TOOLS.map((tool) => (
          <Pressable
            key={tool.id}
            style={styles.card}
            onPress={() => navigation.navigate("Tool", { path: tool.path, name: tool.name })}
          >
            <View>
              <Text style={styles.cardTitle}>{tool.name}</Text>
              <Text style={styles.cardMeta}>{tool.tagline}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0e14" },
  container: { padding: 20, gap: 12, paddingBottom: 40 },
  title: { color: "#f9fafb", fontSize: 26, fontWeight: "800" },
  subtitle: { color: "#9ca3af", fontSize: 14, marginBottom: 4 },
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
})
