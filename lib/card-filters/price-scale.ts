export const PRICE_MIN = 0
export const PRICE_MAX = 5_000

export function clampPrice(value: number): number {
  return Math.min(PRICE_MAX, Math.max(PRICE_MIN, value))
}

export function formatPriceLabel(amount: number, options?: { ceiling?: boolean }): string {
  if (options?.ceiling && amount >= PRICE_MAX) return "$5,000+"
  if (amount <= 0) return "$0"
  return `$${amount.toLocaleString("en-US")}`
}

export function formatPriceRange(min: number, max: number): string {
  if (min <= PRICE_MIN && max >= PRICE_MAX) return "Any price"
  if (min <= PRICE_MIN) return `Under ${formatPriceLabel(max, { ceiling: true })}`
  if (max >= PRICE_MAX) return `${formatPriceLabel(min)}+`
  return `${formatPriceLabel(min)} – ${formatPriceLabel(max)}`
}
