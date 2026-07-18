import * as Notifications from "expo-notifications"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { SafeAreaView } from "react-native-safe-area-context"
import * as Clipboard from "expo-clipboard"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { COLLECTOOLS_BASE_URL } from "../lib/config"
import type { RootStackParamList } from "../lib/navigation"
import { colors } from "../lib/theme"
import { useQueueWatch } from "../lib/queue-watch"
import { SESSION_KEY, TOKEN_KEY } from "../lib/queue-watch/pro-access"
import { buildInstallBookmarklet, createSessionId } from "../lib/queue-watch/build-bookmarklet"

const POLL_MS = 5_000

type StatusResponse = {
  live: boolean
  confidence: number
  source: string
  checkedAt: string
  bookmarklet: { fresh?: boolean; reportedAt?: string } | null
  guidance?: string | null
}

const STEPS = [
  {
    title: "Copy the widget code",
    body: 'Tap "Copy Widget Code" below. This is your private Queue Watcher bookmarklet.',
  },
  {
    title: "Create a bookmark",
    body:
      Platform.OS === "ios"
        ? "In your browser, tap Share → Add Bookmark. Name it “PC Queue”."
        : "In Chrome or your default browser, open Bookmarks → add a new bookmark named “PC Queue”.",
  },
  {
    title: "Paste & run on drops",
    body:
      "Edit the bookmark, paste the code into the URL field, save. On drop day, open pokemoncenter.com and tap your bookmark.",
  },
] as const

function formatRelativeTime(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  return `${Math.floor(seconds / 60)}m ago`
}

export default function InstallQueueWatcherScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { hasPro, proChecking, refreshProAccess } = useQueueWatch()
  const [sessionId, setSessionId] = useState("")
  const [token, setToken] = useState("")
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [copied, setCopied] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const previousLiveRef = useRef(false)

  useEffect(() => {
    void (async () => {
      let sid = (await AsyncStorage.getItem(SESSION_KEY))?.trim()
      if (!sid) {
        sid = createSessionId()
        await AsyncStorage.setItem(SESSION_KEY, sid)
      }
      setSessionId(sid)
      setToken((await AsyncStorage.getItem(TOKEN_KEY))?.trim() || "")
    })()
  }, [])

  const widgetCode = useMemo(() => {
    if (!sessionId || !token) return ""
    return buildInstallBookmarklet(sessionId, token)
  }, [sessionId, token])

  const fetchStatus = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(
        `${COLLECTOOLS_BASE_URL}/api/pokemon-center/status?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`,
        { headers: { "X-Queue-Watch-Token": token } },
      )
      if (!res.ok) {
        setStatusError(res.status === 403 ? "Pro subscription required." : "Could not load status.")
        return
      }
      const data = (await res.json()) as StatusResponse
      setStatus(data)
      setStatusError(null)

      if (data.live && !previousLiveRef.current) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Pokemon Center queue is LIVE",
            body: "Open your browser, go to pokemoncenter.com, and tap your PC Queue bookmark.",
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
          },
          trigger: null,
        })
      }
      previousLiveRef.current = data.live
    } catch {
      setStatusError("Offline — alerts still work when connected.")
    }
  }, [sessionId, token])

  useEffect(() => {
    if (!token || !hasPro) return
    void fetchStatus()
    const timer = setInterval(() => void fetchStatus(), POLL_MS)
    return () => clearInterval(timer)
  }, [token, hasPro, fetchStatus])

  const copyWidgetCode = useCallback(async () => {
    if (!widgetCode) return
    await Clipboard.setStringAsync(widgetCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [widgetCode])

  const openCollecTools = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack()
      return
    }
    navigation.navigate("Home")
  }, [navigation])

  const openPointScan = useCallback(() => {
    navigation.navigate("PointScan", { tool: "slabcrack" })
  }, [navigation])

  const openPokeWatchWeb = useCallback(() => {
    void Linking.openURL(`${COLLECTOOLS_BASE_URL}/pokewatch`)
  }, [])

  const statusLabel = useMemo(() => {
    if (status?.live) return "Queue is LIVE"
    if (status?.bookmarklet?.fresh) return "Watcher connected"
    if (status?.bookmarklet?.reportedAt) return "Watcher stale — tap bookmark on PC"
    return "Waiting for drop"
  }, [status])

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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>Low-risk · Bookmarklet · Push alerts</Text>
        <Text style={styles.title}>Install Queue Watcher</Text>
        <Text style={styles.subtitle}>
          This app never loads Pokemon Center directly. Install the watcher in your mobile browser,
          then get push alerts when the queue goes live.
        </Text>

        <Pressable style={styles.secondaryButton} onPress={openPointScan}>
          <Text style={styles.secondaryButtonText}>Point & Scan cards (native OCR)</Text>
        </Pressable>

        <View style={[styles.card, status?.live ? styles.cardLive : null]}>
          <Text style={styles.cardLabel}>Live log</Text>
          <Text style={[styles.cardTitle, status?.live ? styles.cardTitleLive : null]}>
            {statusLabel}
          </Text>
          {status?.checkedAt && (
            <Text style={styles.meta}>
              Updated {formatRelativeTime(status.checkedAt)}
              {status.source ? ` · ${status.source}` : ""}
            </Text>
          )}
          {statusError && <Text style={styles.warn}>{statusError}</Text>}
        </View>

        {!hasPro ? (
          <View style={styles.lockCard}>
            <Text style={styles.lockTitle}>Pro required</Text>
            <Text style={styles.lockBody}>
              Sign in on CollecTools with Pro, open PokeWatch once to link your token, then return
              here and tap Refresh.
            </Text>
            <Pressable style={styles.primaryButton} onPress={openCollecTools}>
              <Text style={styles.primaryButtonText}>Open CollecTools to sign in</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={() => void refreshProAccess()}>
              <Text style={styles.ghostButtonText}>Refresh access</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable style={styles.secondaryButton} onPress={openCollecTools}>
              <Text style={styles.secondaryButtonText}>Back to CollecTools</Text>
            </Pressable>

            <Pressable
              style={[styles.primaryButton, !widgetCode && styles.buttonDisabled]}
              onPress={() => void copyWidgetCode()}
              disabled={!widgetCode}
            >
              <Text style={styles.primaryButtonText}>
                {copied ? "Copied to clipboard!" : "Copy Widget Code"}
              </Text>
            </Pressable>

            <View style={styles.steps}>
              <Text style={styles.stepsHeading}>3 steps to install</Text>
              {STEPS.map((step, index) => (
                <View key={step.title} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{index + 1}</Text>
                  </View>
                  <View style={styles.stepCopy}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepBody}>{step.body}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Pressable style={styles.secondaryButton} onPress={openPokeWatchWeb}>
              <Text style={styles.secondaryButtonText}>Enable phone alerts on web</Text>
            </Pressable>
          </>
        )}

        <Text style={styles.footer}>
          On drop day: when you get a push, open your browser, go to pokemoncenter.com, and tap your
          PC Queue bookmark to monitor your place in line.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingTop: 12, gap: 14, paddingBottom: 32 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  muted: { color: colors.textMuted, fontSize: 13 },
  kicker: { color: colors.primary, fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 26, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 4,
  },
  cardLive: { borderColor: colors.live, backgroundColor: colors.liveBg },
  cardLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  cardTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
  cardTitleLive: { color: colors.liveSoft },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  warn: { color: colors.warn, fontSize: 12, marginTop: 6 },
  lockCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 10,
  },
  lockTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  lockBody: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: colors.primaryStrong,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.45 },
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
  ghostButtonText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  steps: { gap: 12, marginTop: 4 },
  stepsHeading: { color: colors.text, fontSize: 15, fontWeight: "700" },
  stepRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: { color: colors.white, fontWeight: "800", fontSize: 13 },
  stepCopy: { flex: 1, gap: 2 },
  stepTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  stepBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  footer: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 4 },
})
