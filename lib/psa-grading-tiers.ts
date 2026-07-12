/**
 * PSA trading-card grading service levels.
 * Prices aligned to PSA’s published schedule (as of mid-2026).
 * Value tiers remain listed but marked unavailable while PSA has them paused.
 * Always verify at https://www.psacard.com/services/tradingcardgrading/grading before submitting.
 */

export type PsaGradingTier = {
  id: string
  /** Short chip label */
  label: string
  /** Full service name */
  name: string
  /** Per-card grading fee (USD) */
  fee: number
  /** Max insured / declared value (USD); Premium 10 scales above this floor */
  maxValue: number
  /** Estimated grading turnaround (business days), not door-to-door */
  turnaround: string
  /** False while PSA is not accepting new orders for this tier */
  available: boolean
}

/** Full PSA schedule — Value tiers paused; Regular is the current entry point. */
export const PSA_GRADING_TIERS: PsaGradingTier[] = [
  {
    id: "value-bulk",
    label: "Value Bulk",
    name: "Value Bulk",
    fee: 24.99,
    maxValue: 500,
    turnaround: "~95 biz days",
    available: false,
  },
  {
    id: "value",
    label: "Value",
    name: "Value",
    fee: 32.99,
    maxValue: 500,
    turnaround: "~75 biz days",
    available: false,
  },
  {
    id: "value-plus",
    label: "Value+",
    name: "Value Plus",
    fee: 49.99,
    maxValue: 500,
    turnaround: "~45 biz days",
    available: false,
  },
  {
    id: "value-max",
    label: "Value Max",
    name: "Value Max",
    fee: 64.99,
    maxValue: 1000,
    turnaround: "~35 biz days",
    available: false,
  },
  {
    id: "regular",
    label: "Regular",
    name: "Regular",
    fee: 79.99,
    maxValue: 1500,
    turnaround: "~40–50 biz days",
    available: true,
  },
  {
    id: "express",
    label: "Express",
    name: "Express",
    fee: 149,
    maxValue: 2500,
    turnaround: "~20–30 biz days",
    available: true,
  },
  {
    id: "super-express",
    label: "Super Exp.",
    name: "Super Express",
    fee: 349,
    maxValue: 5000,
    turnaround: "~7–10 biz days",
    available: true,
  },
  {
    id: "walk-through",
    label: "Walk-Thru",
    name: "Walk-Through",
    fee: 599,
    maxValue: 10_000,
    turnaround: "~5–7 biz days",
    available: true,
  },
  {
    id: "premium-1",
    label: "Prem. 1",
    name: "Premium 1",
    fee: 999,
    maxValue: 25_000,
    turnaround: "~5–7 biz days",
    available: true,
  },
  {
    id: "premium-2",
    label: "Prem. 2",
    name: "Premium 2",
    fee: 1999,
    maxValue: 50_000,
    turnaround: "~5–7 biz days",
    available: true,
  },
  {
    id: "premium-3",
    label: "Prem. 3",
    name: "Premium 3",
    fee: 2999,
    maxValue: 100_000,
    turnaround: "~5–7 biz days",
    available: true,
  },
  {
    id: "premium-5",
    label: "Prem. 5",
    name: "Premium 5",
    fee: 4999,
    maxValue: 250_000,
    turnaround: "~5–7 biz days",
    available: true,
  },
  {
    id: "premium-10",
    label: "Prem. 10",
    name: "Premium 10",
    fee: 9999,
    maxValue: 350_000,
    turnaround: "~5–7 biz days",
    available: true,
  },
]

/** Tiers PSA is currently accepting (Value paused). */
export const PSA_AVAILABLE_GRADING_TIERS = PSA_GRADING_TIERS.filter((t) => t.available)

export const DEFAULT_PSA_GRADING_TIER_ID = "regular"

export const DEFAULT_PSA_GRADING_FEE =
  PSA_AVAILABLE_GRADING_TIERS.find((t) => t.id === DEFAULT_PSA_GRADING_TIER_ID)?.fee ?? 79.99

export function findPsaGradingTier(id: string): PsaGradingTier | undefined {
  return PSA_GRADING_TIERS.find((t) => t.id === id)
}

export function findPsaTierByFee(fee: number, tolerance = 0.02): PsaGradingTier | undefined {
  return PSA_GRADING_TIERS.find((t) => Math.abs(t.fee - fee) <= tolerance)
}

/** Format a PSA fee for UI chips (keeps .99 when present). */
export function formatPsaFee(fee: number): string {
  return Number.isInteger(fee) ? `$${fee}` : `$${fee.toFixed(2)}`
}
