import "server-only"
import {
  extractCardPrices,
  resolvePriceChartingForCard,
} from "@/lib/pricecharting"

export type BinderPriceRequest = {
  slot: number
  name: string
  set?: string
  number?: string
}

export type BinderPriceResult =
  | {
      ok: true
      slot: number
      name: string
      set: string
      number: string
      productName: string
      consoleName: string
      productId: string | null
      prices: {
        rawNm: number
        psa7: number
        psa8: number
        psa9: number
        psa10: number
      }
      trend: {
        rawNm: number
        gradedSpread: number | null
        bestGrade: { grade: number; price: number } | null
      }
    }
  | {
      ok: false
      slot: number
      name: string
      set: string
      number: string
      error: string
    }

export async function priceBinderCards(
  cards: BinderPriceRequest[],
  apiKeyOverride?: string,
): Promise<BinderPriceResult[]> {
  const apiKey = (apiKeyOverride || process.env.PRICECHARTING_API_KEY || "").trim()
  if (!apiKey) throw new Error("PRICECHARTING_API_KEY is not configured.")

  const results: BinderPriceResult[] = []
  for (const card of cards) {
    try {
      const { product, resolvedId } = await resolvePriceChartingForCard(apiKey, {
        cardName: card.name,
        setName: card.set || "",
        cardNumber: card.number || "",
        fast: true,
      })
      const { rawPrice, grades, name } = extractCardPrices(product)
      const byGrade = Object.fromEntries(grades.map((g) => [g.grade, g.price])) as Record<
        number,
        number
      >
      const psa7 = byGrade[7] || 0
      const psa8 = byGrade[8] || 0
      const psa9 = byGrade[9] || 0
      const psa10 = byGrade[10] || 0
      const bestGrade =
        [
          { grade: 10, price: psa10 },
          { grade: 9, price: psa9 },
          { grade: 8, price: psa8 },
          { grade: 7, price: psa7 },
        ].find((g) => g.price > 0) || null

      results.push({
        ok: true,
        slot: card.slot,
        name: card.name,
        set: card.set || "",
        number: card.number || "",
        productName: name,
        consoleName: product["console-name"] || "",
        productId: resolvedId || (product.id != null ? String(product.id) : null),
        prices: { rawNm: rawPrice, psa7, psa8, psa9, psa10 },
        trend: {
          rawNm: rawPrice,
          gradedSpread:
            rawPrice > 0 && psa10 > 0 ? Number((psa10 - rawPrice).toFixed(2)) : null,
          bestGrade,
        },
      })
    } catch (err) {
      results.push({
        ok: false,
        slot: card.slot,
        name: card.name,
        set: card.set || "",
        number: card.number || "",
        error: err instanceof Error ? err.message : "Price lookup failed",
      })
    }
  }
  return results
}
