import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RouteProp } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"
import { CameraView, useCameraPermissions } from "expo-camera"
import * as Haptics from "expo-haptics"
import { extractTextFromImage, isSupported } from "expo-text-extractor"
import { ScanMatchSheet } from "../components/ScanMatchSheet"
import type { RootStackParamList } from "../lib/navigation"
import { SCAN_FRAME_MS, SCAN_SAME_CARD_COOLDOWN_MS } from "../lib/scan/constants"
import { matchCatalogFromOcr } from "../lib/scan/match-api"
import { hasOcrMatchFields, parseOcrLines } from "../lib/scan/ocr-parse"
import type { ScanMatchResult } from "../lib/scan/types"
import { colors } from "../lib/theme"

type Props = {
  tool?: "slabcrack" | "slablab"
}

export default function PointScanScreen(_props: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, "PointScan">>()
  const tool = route.params?.tool ?? "slabcrack"
  const cameraRef = useRef<CameraView>(null)
  const busyRef = useRef(false)
  const lastMatchIdRef = useRef<string | null>(null)
  const lastMatchAtRef = useRef(0)

  const [permission, requestPermission] = useCameraPermissions()
  const [status, setStatus] = useState("Point camera at card name & number")
  const [scanning, setScanning] = useState(true)
  const [match, setMatch] = useState<ScanMatchResult | null>(null)

  const paused = Boolean(match)

  const runScanFrame = useCallback(async () => {
    if (busyRef.current || paused || !cameraRef.current) return
    busyRef.current = true
    setScanning(true)

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        shutterSound: false,
        skipProcessing: true,
      })
      if (!photo?.uri) return

      if (!isSupported) {
        setStatus("Text recognition not supported on this device")
        return
      }

      const lines = await extractTextFromImage(photo.uri)
      const detected = parseOcrLines(lines)
      if (!hasOcrMatchFields(detected)) {
        setStatus("Align card in frame — reading text…")
        return
      }

      setStatus(`Matching ${detected!.cardName} #${detected!.cardNumber}…`)
      const result = await matchCatalogFromOcr(detected!)
      if (!result?.card) {
        setStatus("No catalog match — adjust lighting or angle")
        return
      }

      const cardId = result.card.id
      if (
        cardId === lastMatchIdRef.current &&
        Date.now() - lastMatchAtRef.current < SCAN_SAME_CARD_COOLDOWN_MS
      ) {
        return
      }

      lastMatchIdRef.current = cardId
      lastMatchAtRef.current = Date.now()
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setMatch(result)
      setStatus("Card matched")
    } catch {
      setStatus("Scan failed — try again")
    } finally {
      busyRef.current = false
      setScanning(false)
    }
  }, [paused])

  useEffect(() => {
    if (!permission?.granted || paused) return
    const timer = setInterval(() => {
      void runScanFrame()
    }, SCAN_FRAME_MS)
    return () => clearInterval(timer)
  }, [permission?.granted, paused, runScanFrame])

  const dismissMatch = useCallback(() => {
    setMatch(null)
    setStatus("Point camera at card name & number")
  }, [])

  const openInApp = useCallback(() => {
    if (!match?.card) return
    const q = encodeURIComponent(`${match.card.cardName} ${match.card.cardNumber}`.trim())
    navigation.navigate("CollecTools", {
      initialPath: `/binder?q=${q}`,
    })
  }, [match, navigation])

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    )
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permissionBox}>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            Point & Scan uses your camera to read card names and collector numbers with on-device
            ML Kit / Apple Vision OCR.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => void requestPermission()}>
            <Text style={styles.primaryButtonText}>Allow camera</Text>
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const toolLabel = tool === "slablab" ? "SlabLab" : "SlabCrack"

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" mode="picture" />

      <SafeAreaView style={styles.overlay} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{toolLabel} Point & Scan</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.guideWrap}>
          <View style={[styles.guide, paused ? styles.guidePaused : scanning ? styles.guideActive : null]}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>

        <View style={styles.statusPillWrap}>
          <Text style={styles.statusPill}>{paused ? "Match found" : status}</Text>
        </View>
      </SafeAreaView>

      {match?.card ? (
        <SafeAreaView style={styles.sheetWrap} edges={["bottom"]}>
          <ScanMatchSheet
            card={match.card}
            onOpenInApp={openInApp}
            onScanNext={dismissMatch}
          />
        </SafeAreaView>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  backButton: {
    minWidth: 56,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  guideWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  guide: {
    width: "78%",
    aspectRatio: 63 / 88,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.75)",
    borderRadius: 14,
    position: "relative",
  },
  guideActive: {
    borderColor: colors.primary,
  },
  guidePaused: {
    borderColor: colors.primary,
    opacity: 0.65,
  },
  corner: {
    position: "absolute",
    width: 18,
    height: 18,
    borderColor: "#fff",
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  statusPillWrap: {
    alignItems: "center",
    paddingBottom: 16,
  },
  statusPill: {
    color: colors.text,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  sheetWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  permissionBox: {
    gap: 12,
    maxWidth: 320,
  },
  permissionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  permissionBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: colors.primaryStrong,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: "600",
  },
})
