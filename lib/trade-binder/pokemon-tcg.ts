import type { CatalogCard, Rarity } from "./cards"

export type PokemonApiCard = {
  id: string
  name: string
  number?: string
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

export function parseBinderSearchTokens(q: string): { name: string; number?: string } {
  const trimmed = q.trim()
  if (!trimmed) return { name: "" }

  const tokens = trimmed.split(/\s+/).filter(Boolean)
  const numberIndex = tokens.findIndex((token) => /^#?\d{1,4}$/.test(token))

  if (numberIndex >= 0) {
    const number = tokens[numberIndex].replace(/^#/, "")
    const name = tokens.filter((_, index) => index !== numberIndex).join(" ").trim()
    return { name, number }
  }

  return { name: trimmed }
}

export function cardNumberMatches(cardNumber: string | undefined, target: string): boolean {
  if (!target) return true
  if (!cardNumber) return false

  const prefix =
    cardNumber
      .split("/")[0]
      ?.replace(/^#/, "")
      .replace(/^0+/, "") || "0"
  const normalizedTarget = target.replace(/^#/, "").replace(/^0+/, "") || "0"
  return prefix === normalizedTarget
}

export function buildPokemonSearchQueries(q: string): string[] {
  const { name, number } = parseBinderSearchTokens(q)
  if (!name && number) {
    const padded = number.padStart(3, "0")
    return [`number:${number}`, ...(padded !== number ? [`number:${padded}`] : [])]
  }
  if (!name) return []

  const escaped = name.replace(/[+\-&|!(){}[\]^"~*?:\\\/]/g, "\\$&")

  if (number) {
    const padded = number.padStart(3, "0")
    const queries = [
      `name:"${escaped}" number:${number}`,
      `name:"${escaped}" number:${padded}`,
      `name:${escaped} number:${number}`,
    ]
    if (padded !== number) queries.push(`name:"${escaped}" number:${padded}`)
    return queries
  }

  return [`(name:*${escaped}* OR set.name:*${escaped}*)`]
}

export function buildPokemonSearchQuery(q: string): string {
  return buildPokemonSearchQueries(q)[0] ?? ""
}
