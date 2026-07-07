import type { ConditionState } from "@/components/condition-log"
import type { PsaGradeNumber } from "@/lib/slab-data"

export type BorderInsets = {
  left: number
  right: number
  top: number
  bottom: number
}

export type ExtendedGradeCondition = ConditionState & {
  whitening: number
  scratches: number
  holoWear: number
}

export const DEFAULT_BORDER_INSETS: BorderInsets = {
  left: 25,
  right: 25,
  top: 25,
  bottom: 25,
}

export const DEFAULT_EXTENDED_CONDITION: ExtendedGradeCondition = {
  centering: 8,
  corners: 8,
  edges: 8,
  surface: 8,
  whitening: 9,
  scratches: 9,
  holoWear: 9,
}

/** PSA-style centering score from measured border widths (% of card edge). */
export function centeringScoreFromBorders(borders: BorderInsets): number {
  const horizontal =
    Math.min(borders.left, borders.right) / Math.max(borders.left, borders.right, 1)
  const vertical =
    Math.min(borders.top, borders.bottom) / Math.max(borders.top, borders.bottom, 1)
  const worst = Math.min(horizontal, vertical)

  if (worst >= 0.818) return 10
  if (worst >= 0.667) return 9
  if (worst >= 0.538) return 8
  if (worst >= 0.429) return 7
  if (worst >= 0.333) return 6
  return 5
}

export function formatCenteringRatio(borders: BorderInsets): string {
  const left = borders.left
  const right = borders.right
  const top = borders.top
  const bottom = borders.bottom
  const hLarge = Math.max(left, right)
  const hSmall = Math.min(left, right)
  const vLarge = Math.max(top, bottom)
  const vSmall = Math.min(top, bottom)
  const h = `${Math.round((hLarge / (hLarge + hSmall)) * 100)}/${Math.round((hSmall / (hLarge + hSmall)) * 100)}`
  const v = `${Math.round((vLarge / (vLarge + vSmall)) * 100)}/${Math.round((vSmall / (vLarge + vSmall)) * 100)}`
  return `${h} L/R · ${v} T/B`
}

/** Measured border thicknesses as % of card width (L/R) or height (T/B). */
export function borderThicknesses(borders: BorderInsets) {
  return {
    top: borders.top,
    bottom: borders.bottom,
    left: borders.left,
    right: borders.right,
  }
}

export function borderBalanceLabel(larger: number, smaller: number): string {
  const total = larger + smaller
  if (total <= 0) return "—"
  const pctLarge = Math.round((larger / total) * 100)
  const pctSmall = Math.round((smaller / total) * 100)
  return `${pctLarge}/${pctSmall}`
}

export function effectiveGradeCondition(state: ExtendedGradeCondition): ConditionState {
  const cornerCap = Math.min(state.corners, state.whitening)
  const edgeCap = Math.min(state.edges, state.whitening)
  const surfaceCap = Math.min(state.surface, state.scratches, state.holoWear)

  return {
    centering: state.centering,
    corners: cornerCap,
    edges: edgeCap,
    surface: surfaceCap,
  }
}

export type GradeBandEstimate = {
  average: number
  floor: number
  point: number
  low: PsaGradeNumber
  high: PsaGradeNumber
  label: string
  confidence: "high" | "medium" | "low"
}

export function estimateGradeBand(condition: ConditionState): GradeBandEstimate {
  const values = [condition.centering, condition.corners, condition.edges, condition.surface]
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const floor = Math.min(...values)
  const point = Math.max(7, Math.min(9, Math.round((average + floor) / 2))) as PsaGradeNumber

  const low = Math.max(7, point - 1) as PsaGradeNumber
  const high = point

  const spread = average - floor
  const confidence = spread <= 0.75 ? "high" : spread <= 1.5 ? "medium" : "low"

  const label =
    low === high ? `PSA ${high}` : `PSA ${low}–${high}`

  return { average, floor, point, low, high, label, confidence }
}

export function confidenceLabel(confidence: GradeBandEstimate["confidence"]): string {
  if (confidence === "high") return "High confidence — subgrades are consistent"
  if (confidence === "medium") return "Medium confidence — one subgrade may limit the result"
  return "Low confidence — wide spread; grade could come in lower"
}
