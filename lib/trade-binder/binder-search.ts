import {
  cardNumberMatches,
  parseBinderSearchTokens,
  resolveBinderSetIdHint,
} from "@/lib/trade-binder/pokemon-tcg"

export type BinderSearchResultCard = {
  id: string
  name: string
  set: string
  rarity: string
  image: string
  cardNumber?: string
  rawPrice?: number
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+\([^)]+\)$/, "").trim()
}

function mergeKey(card: BinderSearchResultCard): string {
  const num = card.cardNumber?.split("/")[0]?.replace(/^#/, "").replace(/^0+/, "") ?? ""
  return `${normalizeName(card.name)}|${card.set.toLowerCase()}|${num}`
}

function cardMatchesSetHint(setName: string, setHint: string, cardId?: string): boolean {
  const hint = setHint.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (!hint) return true

  const resolved = resolveBinderSetIdHint(setHint)?.toLowerCase()
  const setCompact = setName.toLowerCase().replace(/[^a-z0-9]/g, "")
  const idLower = cardId?.toLowerCase() ?? ""

  if (resolved && (setCompact.includes(resolved) || idLower.includes(resolved))) return true
  if (setCompact.includes(hint) || idLower.includes(hint)) return true
  if (idLower.includes(`poke-${hint}-`) || idLower.includes(`-${hint}-`)) return true
  return false
}

function scoreSearchResult(
  card: BinderSearchResultCard,
  query: string,
  tokens: ReturnType<typeof parseBinderSearchTokens>,
): number {
  const q = query.toLowerCase()
  const name = normalizeName(card.name)
  let score = 0

  if (tokens.name && name === normalizeName(tokens.name)) score += 30
  else if (tokens.name && name.startsWith(normalizeName(tokens.name))) score += 18

  if (tokens.number && cardNumberMatches(card.cardNumber, tokens.number)) score += 40
  if (tokens.setHint && cardMatchesSetHint(card.set, tokens.setHint, card.id)) score += 35

  for (const token of q.split(/\s+/).filter(Boolean)) {
    if (token.length < 2) continue
    if (/^\d+$/.test(token)) {
      if (cardNumberMatches(card.cardNumber, token)) score += 12
    } else if (`${name} ${card.set}`.toLowerCase().includes(token)) {
      score += 4
    }
  }

  if (card.id.startsWith("poke-") || (!card.id.startsWith("pc-") && card.id.includes("-"))) {
    score += 2
  }
  if (card.image && !card.image.includes("placeholder")) score += 1

  return score
}

export function mergeBinderSearchResults(
  cards: BinderSearchResultCard[],
  query: string,
): BinderSearchResultCard[] {
  const tokens = parseBinderSearchTokens(query)
  const byKey = new Map<string, BinderSearchResultCard>()
  const scored: BinderSearchResultCard[] = []

  for (const card of cards) {
    const key = mergeKey(card)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, card)
      scored.push(card)
      continue
    }

    const preferNew =
      (card.id.startsWith("poke-") || (!card.id.startsWith("pc-") && !existing.id.startsWith("poke-"))) &&
      existing.id.startsWith("pc-")
    if (preferNew) {
      byKey.set(key, card)
      const index = scored.findIndex((c) => mergeKey(c) === key)
      if (index >= 0) scored[index] = card
    }
  }

  const ranked = scored
    .map((card) => ({ card, score: scoreSearchResult(card, query, tokens) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.card)

  if (tokens.number) {
    let numbered = ranked.filter((card) => cardNumberMatches(card.cardNumber, tokens.number))
    if (tokens.setHint) {
      const setMatched = numbered.filter((card) =>
        cardMatchesSetHint(card.set, tokens.setHint!, card.id),
      )
      if (setMatched.length > 0) return setMatched
    }
    if (numbered.length > 0) return numbered
  }

  return ranked
}
