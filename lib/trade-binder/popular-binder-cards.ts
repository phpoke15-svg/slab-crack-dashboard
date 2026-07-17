import { unstable_cache } from "next/cache"
import {
  catalogHitToBinderCard,
  getFeaturedCatalogCards,
} from "@/lib/db/cards-catalog"
import type { BinderSearchResultCard } from "@/lib/trade-binder/binder-search"
import { mergeBinderSearchResults } from "@/lib/trade-binder/binder-search"
import { isEnglishOrJapanesePricedCard } from "@/lib/trade-binder/priced-catalog"

async function featuredCatalogCardsUncached(limit: number): Promise<BinderSearchResultCard[]> {
  const hits = await getFeaturedCatalogCards(limit)
  const cards: BinderSearchResultCard[] = []

  for (const hit of hits) {
    if (!isEnglishOrJapanesePricedCard({ setName: hit.setName, productName: hit.name })) {
      continue
    }
    const card = catalogHitToBinderCard(hit)
    cards.push({
      id: card.id,
      name: card.name,
      set: card.set,
      rarity: card.rarity,
      image: card.image,
      cardNumber: card.cardNumber,
      rawPrice: card.rawPrice,
    })
  }

  return mergeBinderSearchResults(cards, "").slice(0, limit)
}

const getCachedFeaturedCatalogCards = unstable_cache(
  () => featuredCatalogCardsUncached(30),
  ["featured-catalog-cards-30"],
  { revalidate: 3600, tags: ["featured-catalog-cards"] },
)

export async function fetchPopularBinderCards(limit = 30): Promise<BinderSearchResultCard[]> {
  const cards = await getCachedFeaturedCatalogCards()
  return cards.slice(0, limit)
}

/** @deprecated Collectr catalog uses cached featured cards only. */
export async function fetchPopularBinderCardsUncached(limit: number): Promise<BinderSearchResultCard[]> {
  return featuredCatalogCardsUncached(limit)
}
