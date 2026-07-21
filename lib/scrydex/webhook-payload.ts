import type { ScrydexVariant } from "@/lib/scrydex/types"

export function normalizeScrydexWebhookEventName(name: string): string {
  const trimmed = name.trim()
  if (trimmed === "card.price_updated" || trimmed.endsWith(".card.price_updated")) {
    return "card.price_updated"
  }
  if (trimmed === "card.created" || trimmed.endsWith(".card.created")) {
    return "card.created"
  }
  return trimmed
}

export function readScrydexWebhookId(data: Record<string, unknown>): string | null {
  const card = data.card
  const nested =
    card && typeof card === "object" && !Array.isArray(card)
      ? (card as Record<string, unknown>)
      : null

  const raw =
    data.scrydex_id ??
    data.scrydexId ??
    data.id ??
    nested?.scrydex_id ??
    nested?.scrydexId ??
    nested?.id

  const value = String(raw ?? "").trim()
  return value || null
}

function readNestedField<T>(
  data: Record<string, unknown>,
  key: string,
  nestedKey?: string,
): T | undefined {
  const card = data.card
  const nested =
    card && typeof card === "object" && !Array.isArray(card)
      ? (card as Record<string, unknown>)
      : null

  if (data[key] != null) return data[key] as T
  if (nestedKey && nested?.[nestedKey] != null) return nested[nestedKey] as T
  if (nested?.[key] != null) return nested[key] as T
  return undefined
}

function extractPricesFromVariants(variants: ScrydexVariant[] | undefined): {
  raw: number | null
  psa10: number | null
} {
  let raw: number | null = null
  let psa10: number | null = null

  for (const variant of variants ?? []) {
    for (const price of variant.prices ?? []) {
      if (price.type === "raw" || (!price.type && !price.company)) {
        const market = price.market ?? price.low
        if (market != null && market > 0 && raw == null) {
          raw = Number(market)
        }
      }
      if (
        price.type === "graded" &&
        String(price.company ?? "").toUpperCase() === "PSA" &&
        String(price.grade) === "10"
      ) {
        const market = price.market ?? price.low
        if (market != null && market > 0) {
          psa10 = Number(market)
        }
      }
    }
  }

  return { raw, psa10 }
}

export function extractScrydexWebhookPrices(data: Record<string, unknown>): {
  raw: number | null
  psa10: number | null
} {
  const directRaw =
    readNestedField<number | null>(data, "current_price_raw", "current_price_raw") ??
    readNestedField<number | null>(data, "price_raw", "price_raw")
  const directPsa10 =
    readNestedField<number | null>(data, "current_price_psa10", "current_price_psa10") ??
    readNestedField<number | null>(data, "price_psa10", "price_psa10")

  if (directRaw != null || directPsa10 != null) {
    return {
      raw: directRaw != null ? Number(directRaw) : null,
      psa10: directPsa10 != null ? Number(directPsa10) : null,
    }
  }

  const variants = readNestedField<ScrydexVariant[]>(data, "variants", "variants")
  return extractPricesFromVariants(variants)
}

export function readScrydexWebhookCardField<T>(
  data: Record<string, unknown>,
  key: string,
  nestedKey?: string,
): T | undefined {
  return readNestedField<T>(data, key, nestedKey)
}
