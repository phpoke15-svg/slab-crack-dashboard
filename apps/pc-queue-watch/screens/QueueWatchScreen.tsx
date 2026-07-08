import { useMemo } from "react"
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native"
import { POKEMON_CENTER_URL } from "../lib/config"
import { POLL_MS, useQueueWatch } from "../lib/queue-watch"

function formatRelativeTime(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

export default function QueueWatchScreen() {
  const { monitoring, autoStart, state, error, start, stop, setAutoStart } = useQueueWatch()

  const statusLabel = useMemo(() => {
    if (state?.live) return "Queue is LIVE"
    if (monitoring) return "Monitoring…"
    return "Idle"
  }, [state?.live, monitoring])

  const toggleMonitoring = () => {
    if (monitoring) stop()
    else void start()
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.kicker}>Native · built in</Text>
        <Text style={styles.title}>Queue Watch</Text>
        <Text style={styles.subtitle}>
          Checks Pokemon Center from your phone every {POLL_MS / 1000} seconds and sends a push notification the
          moment the virtual queue goes live.
        </Text>

        <View style={[styles.card, state?.live ? styles.cardLive : null]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Status</Text>
            {monitoring && !state?.live && <ActivityIndicator color="#60a5fa" size="small" />}
          </View>
          <Text style={[styles.cardTitle, state?.live ? styles.cardTitleLive : null]}>{statusLabel}</Text>
          {state?.checkedAt && (
            <Text style={styles.meta}>
              Last check {formatRelativeTime(state.checkedAt)}
              {state.confidence > 0 ? ` · ${state.confidence}% confidence` : ""}
            </Text>
          )}
          {state?.blocked && !state.live && (
            <Text style={styles.warn}>Imperva bot-check detected. Switch Wi‑Fi/cellular or wait and retry.</Text>
          )}
        </View>

        {state?.signals && state.signals.length > 0 && (
          <View style={styles.signalsCard}>
            <Text style={styles.cardLabel}>Detected signals</Text>
            {state.signals.map((signal) => (
              <View key={signal.id} style={styles.signalRow}>
                <Text style={styles.signalDot}>●</Text>
                <Text style={styles.signalText}>{signal.label}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>Auto-start on launch</Text>
            <Text style={styles.hint}>Begins monitoring when you open the app</Text>
          </View>
          <Switch value={autoStart} onValueChange={(v) => void setAutoStart(v)} />
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>Keep monitoring in background</Text>
            <Text style={styles.hint}>Android: periodic checks when app is backgrounded (about every 5 min)</Text>
          </View>
          <Text style={styles.enabledBadge}>{monitoring ? "ON" : "OFF"}</Text>
        </View>

        <Pressable
          style={[styles.primaryButton, monitoring ? styles.stopButton : null]}
          onPress={toggleMonitoring}
        >
          <Text style={styles.primaryButtonText}>{monitoring ? "Stop monitoring" : "Start monitoring"}</Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryButton, state?.live ? styles.liveButton : null]}
          onPress={() => void Linking.openURL(POKEMON_CENTER_URL)}
        >
          <Text style={styles.secondaryButtonText}>
            {state?.live ? "Join queue on Pokemon Center →" : "Open Pokemon Center"}
          </Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.footer}>
          Monitoring keeps running when you switch tabs. Tap a notification to jump straight to Pokemon Center.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0e14" },
  container: { padding: 20, gap: 12, paddingBottom: 40 },
  kicker: { color: "#93c5fd", fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  title: { color: "#f9fafb", fontSize: 28, fontWeight: "700" },
  subtitle: { color: "#9ca3af", fontSize: 14, lineHeight: 20, marginBottom: 8 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#111827",
    padding: 16,
    gap: 6,
  },
  cardLive: { borderColor: "#34d399", backgroundColor: "rgba(6, 78, 59, 0.35)" },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLabel: { color: "#9ca3af", fontSize: 11, textTransform: "uppercase", fontWeight: "600" },
  cardTitle: { color: "#f9fafb", fontSize: 22, fontWeight: "700" },
  cardTitleLive: { color: "#6ee7b7" },
  meta: { color: "#9ca3af", fontSize: 12 },
  warn: { color: "#fbbf24", fontSize: 12, marginTop: 4 },
  signalsCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#111827",
    padding: 14,
    gap: 8,
  },
  signalRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  signalDot: { color: "#34d399", fontSize: 10 },
  signalText: { color: "#d1d5db", fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#111827",
    padding: 14,
  },
  rowText: { flex: 1 },
  label: { color: "#e5e7eb", fontSize: 14, fontWeight: "600" },
  hint: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  enabledBadge: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    alignItems: "center",
  },
  stopButton: { backgroundColor: "#b91c1c" },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#374151",
    paddingVertical: 12,
    alignItems: "center",
  },
  liveButton: { borderColor: "#34d399", backgroundColor: "rgba(52, 211, 153, 0.12)" },
  secondaryButtonText: { color: "#e5e7eb", fontSize: 14, fontWeight: "600" },
  error: { color: "#f87171", fontSize: 13 },
  footer: { color: "#6b7280", fontSize: 12, lineHeight: 18, marginTop: 8 },
})
