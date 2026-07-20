import {
  catalogPokemonTcgId,
  upsertCatalogCards,
  type CatalogSearchHit,
} from "@/lib/db/cards-catalog"
import { getActivePriceProvider } from "@/lib/pricing/provider"
import { upsertCardPricesSafe } from "@/lib/pricing/db"
import { fetchCardPricesForTarget } from "@/lib/pricing/fetch"
import { promoCardMeta } from "@/lib/trade-binder/promo-card-meta"
import {
  extractTcgGoCardPrices,
  resolveTcgGoCardForTarget,
  tcgGoCardImageUrl,
  tcgGoCardMatchesTarget,
  tcgGoCardNumber,
  tcgGoCardSetName,
} from "@/lib/tcggo-api"
import { mapPokemonRarity } from "@/lib/trade-binder/pokemon-tcg"

function hitToCatalogRow(hit: CatalogSearchHit) {
  const tcgId = catalogPokemonTcgId(hit.id)
  const setId = hit.setId || tcgId.split("-")[0] || "unknown"
  return {
    id: hit.id,
    name: hit.name,
    set_name: hit.setName,
    set_id: setId,
    number: hit.number,
    rarity: hit.rarity,
    image_url: hit.imageUrl,
    language: hit.language,
  }
}

async function enrichHitFromTcgGo(hit: CatalogSearchHit): Promise<CatalogSearchHit> {
  const meta = promoCardMeta(hit.id)
  const tcgCard = await resolveTcgGoCardForTarget({
    cardId: hit.id,
    cardName: hit.name,
    setName: hit.setName,
    cardNumber: hit.number,
    tcgGoId: meta?.tcgGoId,
    tcgplayerId: meta?.tcgplayerId,
  })

  if (!tcgCard || !tcgGoCardMatchesTarget(tcgCard, { cardName: hit.name, cardNumber: hit.number })) {
    if (meta) return { ...hit, imageUrl: "/placeholder.svg" }
    return hit
  }

  const prices = extractTcgGoCardPrices(tcgCard)
  const image = tcgGoCardImageUrl(tcgCard)
  const setName = tcgGoCardSetName(tcgCard)
  const number = tcgGoCardNumber(tcgCard) || hit.number

  return {
    ...hit,
    name: tcgCard.name?.trim() || hit.name,
    setName: setName || hit.setName,
    setId: tcgCard.episode?.code?.toLowerCase() || hit.setId,
    number,
    rarity: mapPokemonRarity(tcgCard.rarity ?? undefined),
    imageUrl: image || hit.imageUrl,
    rawPrice: prices.rawPrice > 0 ? prices.rawPrice : hit.rawPrice,
  }
}

async function persistHitPrices(hit: CatalogSearchHit): Promise<CatalogSearchHit> {
  const provider = getActivePriceProvider()
  if (!provider) return hit

  const meta = promoCardMeta(hit.id)
  try {
    const fetched = await fetchCardPricesForTarget({
      cardId: hit.id,
      cardName: hit.name,
      setName: hit.setName,
      cardNumber: hit.number,
      tcgGoId: meta?.tcgGoId,
      tcgplayerId: meta?.tcgplayerId,
    })

    if ((fetched.rawPrice ?? 0) <= 0 && fetched.psa10Price <= 0) {
      throw new Error("No price returned")
    }

    await upsertCardPricesSafe([
      {
        target: {
          cardId: hit.id,
          cardName: hit.name,
          setName: hit.setName,
          cardNumber: hit.number,
          tcgGoId: meta?.tcgGoId,
          tcgplayerId: meta?.tcgplayerId,
        },
        fetched,
        syncError: null,
      },
    ])

    return { ...hit, rawPrice: fetched.rawPrice > 0 ? fetched.rawPrice : undefined }
  } catch {
    await upsertCardPricesSafe([
      {
        target: {
          cardId: hit.id,
          cardName: hit.name,
          setName: hit.setName,
          cardNumber: hit.number,
          tcgGoId: meta?.tcgGoId,
          tcgplayerId: meta?.tcgplayerId,
        },
        fetched: null,
        syncError: "unavailable",
      },
    ])
    return { ...hit, rawPrice: undefined }
  }
}

/** Upsert catalog rows + card_prices the same way search/lazy pricing does. */
export async function persistDiscoveredCatalogHits(hits: CatalogSearchHit[]): Promise<CatalogSearchHit[]> {
  if (hits.length === 0 || !process.env.SUPABASE_SERVICE_ROLE_KEY) return hits

  const enriched = await Promise.all(hits.map((hit) => enrichHitFromTcgGo(hit)))
  await upsertCatalogCards(enriched.map(hitToCatalogRow))

  const priced: CatalogSearchHit[] = []
  for (const hit of enriched) {
    priced.push(await persistHitPrices(hit))
  }

  return priced
}
