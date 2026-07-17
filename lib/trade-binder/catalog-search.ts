import {
  catalogHitToBinderCard,
  searchCatalogCardsLocal,
} from "@/lib/db/cards-catalog"
import { upgradeCardImageUrlSync } from "@/lib/card-image-url"
import { isEnglishOrJapanesePricedCard } from "@/lib/trade-binder/priced-catalog"
import type { CatalogCard } from "@/lib/trade-binder/cards"

export type BinderCatalogCard = CatalogCard & { rawPrice?: number; cardNumber?: string }

export async function searchBinderCatalog(
  query: string,
  options?: { limit?: number; rawPriceByCardId?: Map<string, number> },
): Promise<BinderCatalogCard[]> {
  const limit = options?.limit ?? 40
  const rawPriceByCardId = options?.rawPriceByCardId ?? new Map<string, number>()

  if (query.trim().length < 2) return []

  const localHits = await searchCatalogCardsLocal(query, limit)
  const cards: BinderCatalogCard[] = []

  for (const hit of localHits) {
    if (!isEnglishOrJapanesePricedCard({ setName: hit.setName, productName: hit.name })) {
      continue
    }

    const card = catalogHitToBinderCard(hit)
    if (!card.rawPrice) {
      const cached = rawPriceByCardId.get(hit.id) ?? rawPriceByCardId.get(hit.id.replace(/^poke-/, ""))
      if (cached && cached > 0) card.rawPrice = cached
    }
    cards.push(card)
  }

  return cards.map((card) => {
    const image = upgradeCardImageUrlSync(card.image)
    return image !== card.image ? { ...card, image } : card
  })
}
