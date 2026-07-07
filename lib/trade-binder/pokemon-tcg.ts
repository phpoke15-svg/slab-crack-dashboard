import type { CatalogCard, Rarity } from "./cards"

export type PokemonApiCard = {
  id: string
  name: string
  rarity?: string
  set?: { name?: string }
  images?: { small?: string; large?: string }
}

export function mapPokemonRarity(rarity?: string): Rarity {
  if (!rarity) return "Common"
  const r = rarity.toLowerCase()
  if (
    r.includes("secret") ||
    r.includes("hyper") ||
    r.includes("special illustration") ||
    r.includes("rainbow") ||
    r.includes("gold")
  ) {
    return "Legendary"
  }
  if (
    r.includes("ultra") ||
    r.includes("illustration rare") ||
    r.includes("amazing") ||
    r.includes("double rare") ||
    r.includes(" ace spec") ||
    r.endsWith(" ace")
  ) {
    return "Epic"
  }
  if (r.includes("holo") || r.includes("rare") || r.includes(" ex") || r.endsWith(" ex")) {
    return "Rare"
  }
  return "Common"
}

export function toCatalogCard(card: PokemonApiCard): CatalogCard {
  return {
    id: card.id,
    name: card.name,
    set: card.set?.name ?? "Unknown Set",
    rarity: mapPokemonRarity(card.rarity),
    image: card.images?.large ?? card.images?.small ?? "/placeholder.svg",
  }
}

export function buildPokemonSearchQuery(q: string): string {
  const trimmed = q.trim()
  if (!trimmed) return ""
  const escaped = trimmed.replace(/[+\-&|!(){}[\]^"~*?:\\\/]/g, "\\$&")
  return `(name:*${escaped}* OR set.name:*${escaped}*)`
}
