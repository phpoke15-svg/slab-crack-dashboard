import {
  cardNumberMatches,
  parseBinderSearchTokens,
  resolveBinderSetIdHint,
} from "@/lib/trade-binder/pokemon-tcg"
import type { CatalogSearchHit } from "@/lib/db/cards-catalog"

/** Cards missing from pokemon-tcg-data / local import but searchable by name+number. */
const SUPPLEMENTAL_CARDS: CatalogSearchHit[] = [
  {
    id: "poke-mep-41",
    name: "Chimchar",
    setName: "Mega Evolution Black Star Promos",
    setId: "mep",
    number: "41",
    rarity: "Common",
    imageUrl: "/placeholder.svg",
    language: "en",
    japaneseName: null,
  },
]

function supplementalMatchesQuery(hit: CatalogSearchHit, query: string): boolean {
  const tokens = parseBinderSearchTokens(query)
  const haystack = `${hit.name} ${hit.setName} ${hit.number} ${hit.setId}`.toLowerCase()

  if (tokens.setHint && tokens.number) {
    const resolved = resolveBinderSetIdHint(tokens.setHint) ?? tokens.setHint.toLowerCase()
    if (!hit.setId.toLowerCase().includes(resolved) && !haystack.includes(tokens.setHint.toLowerCase())) {
      return false
    }
    return cardNumberMatches(hit.number, tokens.number)
  }

  if (tokens.name && tokens.number) {
    if (!cardNumberMatches(hit.number, tokens.number)) return false
    const normalizedName = tokens.name.toLowerCase().trim()
    return hit.name.toLowerCase().includes(normalizedName)
  }

  if (tokens.number && !tokens.name) {
    return cardNumberMatches(hit.number, tokens.number)
  }

  const q = query.trim().toLowerCase()
  if (!q) return false
  return q.split(/\s+/).every((token) => {
    const normalized = token.replace(/^#/, "")
    if (/^\d+$/.test(normalized)) return cardNumberMatches(hit.number, normalized)
    return haystack.includes(normalized)
  })
}

export function searchSupplementalCatalog(query: string, limit = 20): CatalogSearchHit[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  return SUPPLEMENTAL_CARDS.filter((hit) => supplementalMatchesQuery(hit, trimmed)).slice(0, limit)
}
