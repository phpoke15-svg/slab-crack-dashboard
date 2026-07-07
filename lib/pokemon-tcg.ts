export type PokemonApiCard = {
  id: string
  name: string
  number?: string
  rarity?: string
  set?: { id?: string; name?: string }
  images?: { small?: string; large?: string }
}

export type CatalogCard = {
  id: string
  name: string
  setName: string
  cardNumber: string
  rarity: string | null
  imageSmall: string | null
  imageLarge: string | null
}

function stripRaritySuffix(cardName: string): string {
  return cardName
    .replace(/\s*\[[^\]]+\]/g, "")
    .replace(/\s+\([^)]+\)/, "")
    .replace(/\s+#\d+.*$/i, "")
    .replace(/\bEX\b/g, "ex")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeSetHints(setName: string): string[] {
  const hints: string[] = []
  let s = setName
    .replace(/^Pokemon\s+/i, "")
    .replace(/^Japanese\s+/i, "")
    .replace(/^Scarlet & Violet:\s*/i, "")
    .replace(/^Sword & Shield:\s*/i, "")
    .replace(/^Sun & Moon:\s*/i, "")
    .trim()

  if (s) hints.push(s)

  const shortNum = s.match(/\b(151|150|25)\b/)?.[1]
  if (shortNum) hints.push(shortNum)

  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) hints.push(parts.slice(-2).join(" "))
  const last = parts[parts.length - 1]
  if (last && /^\d{2,4}$/.test(last)) hints.push(last)

  return [...new Set(hints.filter((h) => h.length > 2))]
}

function cardNumberPrefix(cardNumber: string): string {
  return cardNumber.split("/")[0]?.trim() ?? cardNumber
}

function escapeLucene(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function normalizeForCompare(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function scorePokemonCardMatch(
  card: CatalogCard,
  input: { cardName: string; setName: string; cardNumber: string },
): number {
  const expectedName = stripRaritySuffix(input.cardName)
  const actualName = card.name
  const expectedNorm = normalizeForCompare(expectedName)
  const actualNorm = normalizeForCompare(actualName)

  if (expectedNorm !== actualNorm && !actualNorm.startsWith(expectedNorm)) return 0

  const nameScore = expectedNorm === actualNorm ? 20 : 12

  const expectedNum = cardNumberPrefix(
    input.cardNumber || input.cardName.match(/#(\d+)/)?.[1] || "",
  )
  const actualNum = cardNumberPrefix(card.cardNumber)
  if (!expectedNum || expectedNum !== actualNum) return 0

  let score = nameScore + 15

  const setHints = normalizeSetHints(input.setName)
  const actualSet = card.setName.toLowerCase()
  const setMatched = [...setHints]
    .sort((a, b) => b.length - a.length)
    .some((hint) => {
      const h = hint.toLowerCase()
      if (h.length < 5 && !/^\d{2,4}$/.test(h)) return false
      return actualSet === h || actualSet.includes(h) || h.includes(actualSet)
    })

  if (setMatched) {
    score += 12
  } else if (/japanese/i.test(input.setName)) {
    return 0
  } else {
    return 0
  }

  return score
}

const MIN_POKEMON_MATCH_SCORE = 30

/** Build Lucene queries — multi-word set names must be quoted, not wildcarded. */
export function buildPokemonSearchQueries(input: {
  cardName: string
  setName: string
  cardNumber: string
  pokemonTcgId?: string
}): string[] {
  const name = escapeLucene(stripRaritySuffix(input.cardName))
  const number = cardNumberPrefix(input.cardNumber || input.cardName.match(/#(\d+)/)?.[1] || "")
  const setHints = normalizeSetHints(input.setName)

  const queries: string[] = []
  if (input.pokemonTcgId) queries.push(`id:${input.pokemonTcgId}`)

  for (const setHint of setHints) {
    const escapedSet = escapeLucene(setHint)
    queries.push(`name:"${name}" number:${number} set.name:"${escapedSet}"`)
    const token = setHint.split(/\s+/).find((w) => w.length > 2) ?? setHint
    if (token !== setHint) {
      queries.push(`name:"${name}" number:${number} set.name:${token}`)
    }
  }

  return [...new Set(queries)]
}

/** @deprecated use buildPokemonSearchQueries */
export function buildPokemonSearchQuery(input: {
  cardName: string
  setName: string
  cardNumber: string
}): string {
  return buildPokemonSearchQueries(input)[0]
}

export async function fetchPokemonCardForWatchlist(input: {
  cardName: string
  setName: string
  cardNumber: string
  pokemonTcgId?: string
}): Promise<CatalogCard | null> {
  if (input.pokemonTcgId) {
    const byId = await fetchPokemonCardById(input.pokemonTcgId)
    if (byId && scorePokemonCardMatch(byId, input) >= MIN_POKEMON_MATCH_SCORE) return byId
  }

  let best: CatalogCard | null = null
  let bestScore = 0

  for (const query of buildPokemonSearchQueries(input)) {
    try {
      const cards = await fetchPokemonCardsByQuery(query)
      for (const card of cards) {
        const score = scorePokemonCardMatch(card, input)
        if (score > bestScore) {
          bestScore = score
          best = card
        }
      }
      if (bestScore >= MIN_POKEMON_MATCH_SCORE + 5) break
    } catch {
      /* try next query */
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  return bestScore >= MIN_POKEMON_MATCH_SCORE ? best : null
}

export function toCatalogCard(card: PokemonApiCard): CatalogCard {
  return {
    id: card.id,
    name: card.name,
    setName: card.set?.name ?? "Unknown Set",
    cardNumber: card.number ?? "",
    rarity: card.rarity ?? null,
    imageSmall: card.images?.small ?? null,
    imageLarge: card.images?.large ?? null,
  }
}

async function fetchWithTimeout(url: string, headers: HeadersInit, ms = 12000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { headers, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchPokemonCardsByQuery(query: string, pageSize = 8): Promise<CatalogCard[]> {
  const url = new URL("https://api.pokemontcg.io/v2/cards")
  url.searchParams.set("q", query)
  url.searchParams.set("pageSize", String(pageSize))

  const headers: HeadersInit = { Accept: "application/json" }
  const apiKey = process.env.POKEMON_TCG_API_KEY
  if (apiKey) headers["X-Api-Key"] = apiKey

  const response = await fetchWithTimeout(url.toString(), headers)
  if (!response.ok) {
    throw new Error(`Pokémon TCG API HTTP ${response.status}`)
  }

  const payload = (await response.json()) as { data?: PokemonApiCard[] }
  return (payload.data ?? []).map(toCatalogCard)
}

/** @deprecated prefer fetchPokemonCardsByQuery */
export async function fetchPokemonCardByQuery(query: string): Promise<CatalogCard | null> {
  const cards = await fetchPokemonCardsByQuery(query, 1)
  return cards[0] ?? null
}

export async function fetchPokemonCardById(id: string): Promise<CatalogCard | null> {
  const headers: HeadersInit = { Accept: "application/json" }
  const apiKey = process.env.POKEMON_TCG_API_KEY
  if (apiKey) headers["X-Api-Key"] = apiKey

  const response = await fetchWithTimeout(
    `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(id)}`,
    headers,
  )

  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Pokémon TCG API HTTP ${response.status}`)

  const payload = (await response.json()) as { data?: PokemonApiCard }
  return payload.data ? toCatalogCard(payload.data) : null
}
