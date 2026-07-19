export function normalizePromotionCode(input: string): string {
  return input.trim()
}

export function promotionCodeLooksValid(input: string): boolean {
  const normalized = normalizePromotionCode(input)
  return normalized.length >= 3 && normalized.length <= 64
}
