import { Image, Pressable, StyleSheet, Text, View } from "react-native"
import { colors } from "../lib/theme"
import type { ScanMatchCard } from "../lib/scan/types"

function formatPrice(value: number | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—"
  return `$${value.toFixed(2)}`
}

export function ScanMatchSheet({
  card,
  onOpenInApp,
  onScanNext,
}: {
  card: ScanMatchCard
  onOpenInApp: () => void
  onScanNext: () => void
}) {
  return (
    <View style={styles.sheet}>
      <View style={styles.row}>
        {card.imageUrl ? (
          <Image source={{ uri: card.imageUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
        <View style={styles.meta}>
          <Text style={styles.badge}>Card matched</Text>
          <Text style={styles.name} numberOfLines={2}>
            {card.cardName}
          </Text>
          <Text style={styles.sub} numberOfLines={2}>
            {card.setName}
            {card.cardNumber ? ` · #${card.cardNumber}` : ""}
          </Text>
        </View>
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceCell}>
          <Text style={styles.priceLabel}>Raw</Text>
          <Text style={styles.priceValue}>{formatPrice(card.rawPrice)}</Text>
        </View>
        <View style={styles.priceCell}>
          <Text style={styles.priceLabel}>PSA 10</Text>
          <Text style={styles.priceValue}>{formatPrice(card.psa10Price)}</Text>
        </View>
        <View style={styles.priceCell}>
          <Text style={styles.priceLabel}>PSA 9</Text>
          <Text style={styles.priceValue}>{formatPrice(card.psa9Price)}</Text>
        </View>
      </View>

      <Pressable style={styles.primaryButton} onPress={onOpenInApp}>
        <Text style={styles.primaryButtonText}>Open in CollecTools</Text>
      </Pressable>

      <Pressable onPress={onScanNext} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Scan next card</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.35)",
    backgroundColor: "rgba(11, 14, 20, 0.97)",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  thumb: {
    width: 72,
    height: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: colors.card,
  },
  thumbPlaceholder: {
    backgroundColor: "#111827",
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  name: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  sub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: "row",
    gap: 8,
  },
  priceCell: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingVertical: 8,
    alignItems: "center",
  },
  priceLabel: {
    color: colors.textDim,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  priceValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  primaryButton: {
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
    paddingVertical: 8,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: "600",
  },
})
