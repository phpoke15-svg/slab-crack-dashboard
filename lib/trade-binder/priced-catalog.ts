import { isMainlinePokemonTcg } from "@/lib/pokemon-tcg-filter"
import type { CatalogCard } from "@/lib/trade-binder/cards"
import { mapPokemonRarity } from "@/lib/trade-binder/pokemon-tcg"

export type PricedCatalogCard = CatalogCard & {
  rawPrice: number
  cardNumber?: string
}

export type PricedCatalogSource = {
  id: string
  name: string
  setName: string
  cardNumber?: string
  rarity?: string | null
  imageUrl?: string | null
  rawPrice: number
}

function formatCardName(name: string, rarity?: string | null): string {
  if (!rarity) return name
  if (name.toLowerCase().includes(rarity.toLowerCase())) return name
  return `${name} (${rarity})`
}

/** English + Japanese mainline Pokémon TCG only (excludes Korean, Chinese, promos, etc.). */
export function isEnglishOrJapanesePricedCard(input: {
  setName: string
  productName?: string
}): boolean {
  return isMainlinePokemonTcg({
    setName: input.setName,
    genre: "Pokemon Card",
    productName: input.productName,
  })
}

export function toBinderCatalogCard(source: PricedCatalogSource): PricedCatalogCard | null {
  if (!isEnglishOrJapanesePricedCard({ setName: source.setName, productName: source.name })) {
    return null
  }

  return {
    id: source.id,
    name: formatCardName(source.name, source.rarity),
    set: source.setName,
    rarity: mapPokemonRarity(source.rarity ?? undefined),
    image: source.imageUrl ?? "/placeholder.svg",
    rawPrice: Math.max(0, source.rawPrice),
    cardNumber: source.cardNumber,
  }
}

/** Priced-only catalog entries (raw price required). */
export function toPricedCatalogCard(source: PricedCatalogSource): PricedCatalogCard | null {
  if (source.rawPrice <= 0) return null
  return toBinderCatalogCard(source)
}

export function filterPricedCatalog(
  cards: PricedCatalogCard[],
  query: string,
): PricedCatalogCard[] {
  const q = query.trim().toLowerCase()
  if (!q) return cards

  return cards.filter((card) => {
    const haystack = `${card.name} ${card.set} ${card.cardNumber ?? ""}`.toLowerCase()
    return haystack.includes(q)
  })
}

export function sortPricedCatalog(cards: PricedCatalogCard[]): PricedCatalogCard[] {
  return [...cards].sort((a, b) => {
    if (b.rawPrice !== a.rawPrice) return b.rawPrice - a.rawPrice
    return a.name.localeCompare(b.name)
  })
}
