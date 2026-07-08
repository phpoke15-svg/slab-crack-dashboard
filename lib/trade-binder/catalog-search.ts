import { searchCatalogCards, type CardSearchHit } from "@/lib/card-lookup"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import { mapPokemonRarity } from "@/lib/trade-binder/pokemon-tcg"
import { isEnglishOrJapanesePricedCard } from "@/lib/trade-binder/priced-catalog"
import type { CatalogCard } from "@/lib/trade-binder/cards"

export type BinderCatalogCard = CatalogCard & { rawPrice?: number; cardNumber?: string }

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
    image: upgradeCardImageUrlSync(hit.imageUrl || "/placeholder.svg"),
    cardNumber: hit.cardNumber || undefined,
    rawPrice: rawPrice && rawPrice > 0 ? rawPrice : undefined,
  }
}

export async function searchBinderCatalog(
  query: string,
  options?: { limit?: number; rawPriceByCardId?: Map<string, number>; budgetMs?: number },
): Promise<BinderCatalogCard[]> {
  const limit = options?.limit ?? 40
  const rawPriceByCardId = options?.rawPriceByCardId ?? new Map<string, number>()
  const budgetMs = options?.budgetMs ?? 12_000

  if (query.trim().length < 2) return []

  const hits = await searchCatalogCards(query, limit, budgetMs)
  const cards: BinderCatalogCard[] = []

  for (const hit of hits) {
    const card = hitToBinderCard(hit, rawPriceByCardId)
    if (card) cards.push(card)
  }

  return cards.map((card) => {
    const image = upgradeCardImageUrlSync(card.image)
    return image !== card.image ? { ...card, image } : card
  })
}
