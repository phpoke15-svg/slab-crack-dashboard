import { searchCatalogCards, type CardSearchHit } from "@/lib/card-lookup"
import { mapPokemonRarity } from "@/lib/trade-binder/pokemon-tcg"
import { isEnglishOrJapanesePricedCard } from "@/lib/trade-binder/priced-catalog"
import type { CatalogCard } from "@/lib/trade-binder/cards"

export type BinderCatalogCard = CatalogCard & { rawPrice?: number }

function hitToBinderCard(hit: CardSearchHit, rawPriceByCardId: Map<string, number>): BinderCatalogCard | null {
  if (
    !isEnglishOrJapanesePricedCard({
      setName: hit.setName,
      productName: hit.cardName,
    })
  ) {
    return null
  }

  const rawPrice = rawPriceByCardId.get(hit.id) ?? rawPriceByCardId.get(hit.pokemonTcgId)

  return {
    id: hit.id,
    name: hit.cardName,
    set: hit.setName,
    rarity: mapPokemonRarity(hit.rarity ?? undefined),
    image: hit.imageUrl || "/placeholder.svg",
    rawPrice: rawPrice && rawPrice > 0 ? rawPrice : undefined,
  }
}

export async function searchBinderCatalog(
  query: string,
  options?: { limit?: number; rawPriceByCardId?: Map<string, number> },
): Promise<BinderCatalogCard[]> {
  const limit = options?.limit ?? 40
  const rawPriceByCardId = options?.rawPriceByCardId ?? new Map<string, number>()

  if (query.trim().length < 2) return []

  const hits = await searchCatalogCards(query, limit)
  const cards: BinderCatalogCard[] = []

  for (const hit of hits) {
    const card = hitToBinderCard(hit, rawPriceByCardId)
    if (card) cards.push(card)
  }

  return cards
}
