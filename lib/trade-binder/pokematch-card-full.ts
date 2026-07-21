import { getCardPriceById } from "@/lib/pricing/db"
import { toBinderRawPrice } from "@/lib/pricing/views"
import { ensureScrydexCardFresh } from "@/lib/scrydex/on-demand"
import { isScrydexConfigured, resolveCatalogId, splitCatalogId } from "@/lib/scrydex/constants"
import { loadCardBundle } from "@/lib/scrydex/db"
import { scrydexBundleToCardPriceRow } from "@/lib/scrydex/price-adapter"
import { resolveTcgResearchCard } from "@/lib/tcg-research/card-detail"
import type { TcgGame } from "@/lib/scrydex/types"

export type PokeMatchRecentSale = {
  title: string
  price: number
  shipping: number
  total: number
  soldDate: string
  url?: string
}

export type PokeMatchCardDetailPayload = {
  id: string
  name: string
  setName: string
  cardNumber: string
  imageUrl: string
  rawPrice: number
  hasPricing: boolean
  catalogId: string | null
  scrydexId: string | null
  game: TcgGame
  priceUpdatedAt: string | null
  priceSource: string | null
  marketInsight: string
  recentRawSales: PokeMatchRecentSale[]
}

function pickRawFromBundle(rawRows: Array<{ variant?: string; condition?: string; market_price?: number | null }>): number {
  const row = rawRows.find(
    (entry) => (entry.variant ?? "normal") === "normal" && (entry.condition ?? "NM") === "NM",
  )
  return Number(row?.market_price ?? 0)
}

export async function resolvePokeMatchCardDetail(input: {
  id?: string
  scrydexId?: string
  catalogId?: string
  game?: TcgGame
}): Promise<PokeMatchCardDetailPayload | null> {
  const catalogId =
    input.catalogId ??
    (input.scrydexId && input.game ? `${input.game}-${input.scrydexId}` : null) ??
    (input.id ? resolveCatalogId(input.id) : null)

  const detail = await resolveTcgResearchCard(input)
  if (!detail) return null

  let rawPrice = detail.rawPrice ?? 0
  let priceUpdatedAt = detail.priceUpdatedAt
  let priceSource: string | null = null
  let imageUrl = detail.imageUrl
  let marketInsight = "Raw NM market value for fair-trade matching."

  if (catalogId && isScrydexConfigured()) {
    await ensureScrydexCardFresh(detail.id, { activity: "view" })
  }

  if (catalogId) {
    const bundle = await loadCardBundle(catalogId)
    if (bundle?.card) {
      imageUrl = bundle.card.image_large_url ?? bundle.card.image_small_url ?? imageUrl
      const fromRawRows = pickRawFromBundle(bundle.raw as never[])
      if (fromRawRows > 0) rawPrice = fromRawRows

      const priceRow = scrydexBundleToCardPriceRow({
        card: bundle.card,
        raw: bundle.raw as never[],
        graded: [],
        legacyCardId: detail.id,
      })
      if (priceRow?.raw_price && priceRow.raw_price > 0) {
        rawPrice = priceRow.raw_price
        priceUpdatedAt = priceRow.synced_at ?? priceUpdatedAt
        priceSource = priceRow.price_source ?? "scrydex"
        marketInsight = "Scrydex raw NM market price for fair-trade matching."
      } else if (fromRawRows > 0) {
        priceSource = "scrydex"
      }
    }
  }

  if (!priceSource && rawPrice <= 0) {
    const cached = await getCardPriceById(detail.id)
    const cachedRaw = toBinderRawPrice(cached)
    if (cachedRaw > 0) {
      rawPrice = cachedRaw
      priceUpdatedAt = cached?.synced_at ?? priceUpdatedAt
      priceSource = cached?.price_source ?? "local"
    }
  }

  if (!priceSource && rawPrice > 0) {
    priceSource = "local"
  }

  return {
    id: detail.id,
    name: detail.name,
    setName: detail.setName,
    cardNumber: detail.number,
    imageUrl,
    rawPrice,
    hasPricing: rawPrice > 0,
    catalogId,
    scrydexId: detail.scrydexId,
    game: detail.game ?? splitCatalogId(catalogId ?? "")?.game ?? input.game ?? "pokemon",
    priceUpdatedAt,
    priceSource,
    marketInsight,
    recentRawSales: [],
  }
}
