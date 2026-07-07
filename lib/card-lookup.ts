import {
  extractCardPrices,
  resolvePriceChartingForCard,
  fetchPriceChartingProduct,
  fetchPriceChartingProducts,
  type PriceChartingCardContext,
  type PriceChartingSearchHit,
} from "@/lib/pricecharting"
import {
  fetchPokemonCardById,
  fetchPokemonCardsByQuery,
  type CatalogCard,
} from "@/lib/pokemon-tcg"
import {
  buildGradeQuotes,
  getBestGradeQuote,
  isPsaSlabGrade,
  normalizeCardEntry,
  type MockCardEntry,
  type PsaGradeNumber,
} from "@/lib/slab-data"

export type CardSearchHit = {
  id: string
  pokemonTcgId: string
  cardName: string
  setName: string
  cardNumber: string
  imageUrl: string
  rarity: string | null
}

const LOOKUP_CACHE_TTL_MS = 15 * 60 * 1000
const lookupCache = new Map<string, { entry: MockCardEntry; expiresAt: number }>()

function getCachedLookup(key: string): MockCardEntry | null {
  const hit = lookupCache.get(key)
  if (!hit || hit.expiresAt < Date.now()) {
    lookupCache.delete(key)
    return null
  }
  return hit.entry
}

function setCachedLookup(key: string, entry: MockCardEntry) {
  lookupCache.set(key, { entry, expiresAt: Date.now() + LOOKUP_CACHE_TTL_MS })
}

export function searchHitToPlaceholder(hit: CardSearchHit): MockCardEntry {
  return normalizeCardEntry({
    id: hit.id,
    cardName: hit.cardName,
    setName: hit.setName,
    cardNumber: hit.cardNumber,
    imageUrl: hit.imageUrl,
    rawPrice: 0,
    slabGrade: 8,
    slabPrice: 0,
    deficit: 0,
    percentageSavings: 0,
    marketInsight: "Loading PSA 7–10 comps…",
    gradeQuotes: buildGradeQuotes(0, {}),
    hasPricing: false,
  })
}

export type LookupCatalogContext = {
  cardName: string
  setName: string
  cardNumber: string
  imageUrl?: string
  rarity?: string | null
}

function escapeLucene(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/** User-facing set nicknames → Pokémon TCG API set.id */
const SET_HINT_IDS: Record<string, string> = {
  "151": "sv3pt5",
  pokemon151: "sv3pt5",
  sv151: "sv3pt5",
}

const CARD_NAME_SUFFIXES = new Set(["ex", "gx", "v", "vmax", "vstar", "lv", "x", "break", "prime"])

function isCardNameSuffix(token: string): boolean {
  return CARD_NAME_SUFFIXES.has(token.toLowerCase())
}

function buildNameSetCandidates(tokens: string[]): Array<{ name: string; setHint: string }> {
  const nameFirst: Array<{ name: string; setHint: string }> = []
  const setFirst: Array<{ name: string; setHint: string }> = []
  const seen = new Set<string>()

  const add = (bucket: Array<{ name: string; setHint: string }>, name: string, setHint: string) => {
    const key = `${normalizeToken(name)}|${normalizeToken(setHint)}`
    if (!name.trim() || !setHint.trim() || seen.has(key)) return
    seen.add(key)
    bucket.push({ name: name.trim(), setHint: setHint.trim() })
  }

  for (const nameLen of [1, 2]) {
    if (tokens.length <= nameLen) continue
    if (nameLen === 2 && !isCardNameSuffix(tokens[1])) continue
    add(nameFirst, tokens.slice(0, nameLen).join(" "), tokens.slice(nameLen).join(" "))
  }

  for (const nameLen of [1, 2]) {
    if (tokens.length <= nameLen) continue
    if (nameLen === 2 && !isCardNameSuffix(tokens[tokens.length - 1])) continue
    add(setFirst, tokens.slice(-nameLen).join(" "), tokens.slice(0, -nameLen).join(" "))
  }

  return tokens.length >= 3 ? [...setFirst, ...nameFirst] : [...nameFirst, ...setFirst]
}

function resolveSetIdForHint(hint: string): string | null {
  return SET_HINT_IDS[normalizeToken(hint)] ?? null
}

function sortByCardNumber(cards: CatalogCard[]): CatalogCard[] {
  return [...cards].sort((a, b) => {
    const aNum = Number.parseInt(a.cardNumber.split("/")[0] ?? "", 10)
    const bNum = Number.parseInt(b.cardNumber.split("/")[0] ?? "", 10)
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) return aNum - bNum
    return a.cardNumber.localeCompare(b.cardNumber)
  })
}

function cardMatchesHints(card: CatalogCard, hints: string[]): boolean {
  const setNorm = normalizeToken(card.setName)
  const numNorm = normalizeToken(card.cardNumber.split("/")[0] ?? "")
  const nameNorm = normalizeToken(card.name)

  return hints.every(
    (hint) => setNorm.includes(hint) || numNorm.includes(hint) || nameNorm.includes(hint),
  )
}

type ParsedSearch =
  | { mode: "empty" }
  | { mode: "number"; number: string }
  | { mode: "set"; setHint: string; setId: string | null }
  | { mode: "set-number"; setHint: string; setId: string | null; number: string }
  | { mode: "name"; name: string }
  | { mode: "name-hints"; name: string; hints: string[] }
  | { mode: "set-or-name"; setHint: string; name: string; hints: string[] }
  | { mode: "name-set-combo"; tokens: string[] }

/** Classify free-text search into card name, set, and/or number tokens. */
export function parseSearchInput(input: string): ParsedSearch {
  const trimmed = input.trim()
  if (!trimmed) return { mode: "empty" }

  const slashNumber = trimmed.match(/^#?(\d{1,4})\/(\d{1,4})$/)
  if (slashNumber) return { mode: "number", number: slashNumber[1] }

  const rawTokens = trimmed.split(/\s+/).filter(Boolean)
  const tokens: string[] = []

  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i]
    const lower = token.toLowerCase()
    const next = rawTokens[i + 1]

    if (
      next &&
      /^(vol|volume|series)$/i.test(lower) &&
      /^\d{1,2}$/.test(next)
    ) {
      tokens.push(`${lower} ${next}`)
      i++
      continue
    }

    tokens.push(token)
  }

  const setTokens: string[] = []
  const numberTokens: string[] = []
  const textTokens: string[] = []

  for (const token of tokens) {
    const bare = token.replace(/^#/, "")
    if (resolveSetIdForHint(bare)) {
      setTokens.push(bare)
    } else if (/^(vol|series)\s+\d{1,2}$/i.test(bare)) {
      textTokens.push(bare)
    } else if (/^\d{1,4}$/.test(bare)) {
      numberTokens.push(bare)
    } else {
      textTokens.push(bare)
    }
  }

  if (textTokens.length === 0) {
    if (setTokens.length > 0 && numberTokens.length > 0) {
      return {
        mode: "set-number",
        setHint: setTokens.join(" "),
        setId: resolveSetIdForHint(setTokens[0]),
        number: numberTokens[0],
      }
    }
    if (setTokens.length > 0) {
      return {
        mode: "set",
        setHint: setTokens.join(" "),
        setId: resolveSetIdForHint(setTokens[0]),
      }
    }
    if (numberTokens.length === 1) {
      return { mode: "number", number: numberTokens[0] }
    }
    return { mode: "empty" }
  }

  const trailingHints = [...setTokens, ...numberTokens]
  if (trailingHints.length > 0) {
    return { mode: "name-hints", name: textTokens.join(" "), hints: trailingHints }
  }

  if (textTokens.length === 1) {
    return { mode: "name", name: textTokens[0] }
  }

  if (textTokens.length >= 3) {
    return { mode: "name-set-combo", tokens: textTokens }
  }

  return {
    mode: "set-or-name",
    setHint: textTokens.join(" "),
    name: textTokens[0],
    hints: textTokens.slice(1),
  }
}

async function fetchByNumber(number: string, limit: number): Promise<CatalogCard[]> {
  const cards = await fetchPokemonCardsByQuery(`number:${number}`, limit)
  return sortByCardNumber(cards).slice(0, limit)
}

async function fetchBySet(
  setHint: string,
  setId: string | null,
  limit: number,
): Promise<CatalogCard[]> {
  const queries: string[] = []
  if (setId) queries.push(`set.id:${setId}`)
  queries.push(`set.name:"${escapeLucene(setHint)}"`)

  for (const query of queries) {
    try {
      const cards = await fetchPokemonCardsByQuery(query, limit)
      if (cards.length > 0) return sortByCardNumber(cards).slice(0, limit)
    } catch {
      /* try next query */
    }
  }

  return []
}

async function fetchBySetAndNumber(
  setHint: string,
  setId: string | null,
  number: string,
  limit: number,
): Promise<CatalogCard[]> {
  const queries: string[] = []
  if (setId) queries.push(`set.id:${setId} number:${number}`)
  queries.push(`set.name:"${escapeLucene(setHint)}" number:${number}`)

  for (const query of queries) {
    try {
      const cards = await fetchPokemonCardsByQuery(query, limit)
      if (cards.length > 0) return cards.slice(0, limit)
    } catch {
      /* try next query */
    }
  }

  return []
}

async function fetchByNameAndSet(
  name: string,
  setHint: string,
  limit: number,
): Promise<CatalogCard[]> {
  const escapedName = escapeLucene(name)
  const setId = resolveSetIdForHint(setHint)
  const queries: string[] = []

  if (setId) queries.push(`name:${escapedName} set.id:${setId}`)
  queries.push(`name:${escapedName} set.name:"${escapeLucene(setHint)}"`)

  for (const query of queries) {
    try {
      const cards = await fetchPokemonCardsByQuery(query, limit)
      if (cards.length > 0) return cards.slice(0, limit)
    } catch {
      /* try next query */
    }
  }

  return []
}

async function fetchNameSetCombos(tokens: string[], limit: number): Promise<CatalogCard[]> {
  const candidates = buildNameSetCandidates(tokens)
  const primary = candidates.slice(0, 2)
  const parallelResults = await Promise.all(
    primary.map(({ name, setHint }) => fetchByNameAndSet(name, setHint, limit)),
  )
  for (const cards of parallelResults) {
    if (cards.length > 0) return cards
  }

  for (const { name, setHint } of candidates.slice(2)) {
    const cards = await fetchByNameAndSet(name, setHint, limit)
    if (cards.length > 0) return cards
  }

  return fetchCardsForHints(tokens[0], [tokens.slice(1).join(" ")], limit)
}

async function fetchCardsForHints(
  name: string,
  hints: string[],
  limit: number,
): Promise<CatalogCard[]> {
  const escapedName = escapeLucene(name)
  const normalizedHints = hints.map(normalizeToken).filter(Boolean)
  const queries: string[] = []
  const seenQueries = new Set<string>()

  const addQuery = (query: string) => {
    if (!query || seenQueries.has(query)) return
    seenQueries.add(query)
    queries.push(query)
  }

  for (const hint of hints) {
    const setId = resolveSetIdForHint(hint)
    if (setId) {
      addQuery(`name:${escapedName} set.id:${setId}`)
    } else {
      addQuery(`name:${escapedName} set.name:"${escapeLucene(hint)}"`)
    }
  }

  for (const hint of normalizedHints) {
    if (/^\d+$/.test(hint) && !resolveSetIdForHint(hint)) {
      addQuery(`name:${escapedName} number:${hint}`)
    }
  }

  const hasOnlyNumberHints =
    normalizedHints.length > 0 &&
    normalizedHints.every((hint) => /^\d+$/.test(hint) && !resolveSetIdForHint(hint))

  if (!hasOnlyNumberHints) {
    addQuery(`name:${escapedName}`)
  }

  for (const query of queries) {
    try {
      const pageSize =
        query === `name:${escapedName}` && !hasOnlyNumberHints
          ? Math.min(100, limit * 8)
          : limit
      const cards = await fetchPokemonCardsByQuery(query, pageSize)
      const filtered =
        normalizedHints.length > 0
          ? cards.filter((card) => cardMatchesHints(card, normalizedHints))
          : cards
      if (filtered.length > 0) return filtered
    } catch {
      /* try next query strategy */
    }
  }

  return []
}

/** Build a Pokémon TCG API query from free-text user input. */
export function buildUserSearchQuery(input: string): string {
  const parsed = parseSearchInput(input)
  switch (parsed.mode) {
    case "number":
      return `number:${parsed.number}`
    case "set":
      return parsed.setId ? `set.id:${parsed.setId}` : `set.name:"${escapeLucene(parsed.setHint)}"`
    case "set-number":
      return parsed.setId
        ? `set.id:${parsed.setId} number:${parsed.number}`
        : `set.name:"${escapeLucene(parsed.setHint)}" number:${parsed.number}`
    case "name-hints":
    case "set-or-name":
      return `name:${escapeLucene(parsed.name)}`
    case "name":
      return `name:${escapeLucene(parsed.name)}`
    default:
      return ""
  }
}

export function catalogToSearchHit(card: CatalogCard): CardSearchHit {
  return {
    id: `poke-${card.id}`,
    pokemonTcgId: card.id,
    cardName: card.name,
    setName: card.setName,
    cardNumber: card.cardNumber,
    imageUrl: card.imageLarge ?? card.imageSmall ?? "",
    rarity: card.rarity,
  }
}

function isPokemonCardProduct(hit: PriceChartingSearchHit): boolean {
  const consoleName = (hit["console-name"] ?? "").toLowerCase()
  if (!consoleName.includes("pokemon")) return false
  if (/\b(nintendo|3ds|switch|gameboy|wii|ds)\b/.test(consoleName) && !consoleName.includes("card")) {
    return false
  }
  return true
}

function parseCardNumberFromProductName(productName: string): string {
  const hashMatch = productName.match(/#(\d{1,4}[a-z/-]*)/i)
  if (hashMatch) return hashMatch[1]
  const trailingMatch = productName.match(/\b(\d{1,4})\b(?=[^0-9]*$)/)
  return trailingMatch?.[1] ?? ""
}

function priceChartingHitToSearchHit(hit: PriceChartingSearchHit): CardSearchHit | null {
  if (!hit.id || !isPokemonCardProduct(hit)) return null

  const productName = hit["product-name"] ?? "Unknown card"
  const setName = hit["console-name"] ?? "Unknown set"
  const cardNumber = parseCardNumberFromProductName(productName)
  const cardName =
    productName
      .replace(/\s*#\d+.*$/i, "")
      .replace(/\s+\d{1,4}\/[a-z0-9-]+$/i, "")
      .trim() || productName

  return {
    id: `pc-${hit.id}`,
    pokemonTcgId: `pc-${hit.id}`,
    cardName,
    setName,
    cardNumber,
    imageUrl: "",
    rarity: null,
  }
}

function buildPriceChartingCatalogQueries(query: string, parsed: ParsedSearch): string[] {
  const trimmed = query.trim().toLowerCase().replace(/\s+/g, " ")
  const out = new Set<string>([trimmed])

  if (parsed.mode === "name-hints") {
    const numbers = parsed.hints.filter((h) => /^\d+$/.test(h))
    const words = parsed.hints.filter((h) => !/^\d+$/.test(h))
    const name = parsed.name.toLowerCase()

    for (const num of numbers) {
      out.add(`${name} #${num}`)
      out.add(`${name} #${num}/s-p`)
      out.add(`${name} ${num} pokemon`)
      out.add(`${name} ${num} pokemon japanese`)
      out.add(`${name} stamp box ${num}`)
      if (words.length > 0) {
        out.add(`${name} #${num} ${words.join(" ")}`)
      }
      if (trimmed.includes("stamp") || words.some((w) => w.toLowerCase().includes("stamp"))) {
        out.add(`${name} #${num} stamp box`)
        out.add(`pokemon ${name} ${num} stamp`)
      }
    }

    if (words.length > 0 && numbers.length === 0) {
      out.add(`${name} ${words.join(" ")}`)
      out.add(`pokemon ${name} ${words.join(" ")}`)
    }
  }

  if (parsed.mode === "number") {
    out.add(`pokemon #${parsed.number}`)
    out.add(`pokemon card ${parsed.number}`)
  }

  if (parsed.mode === "name") {
    out.add(`pokemon ${parsed.name.toLowerCase()}`)
    out.add(`${parsed.name.toLowerCase()} pokemon`)
  }

  if (parsed.mode === "name-hints" || parsed.mode === "set-or-name") {
    const hintsJoined = (parsed.mode === "name-hints" ? parsed.hints : parsed.hints).join(" ").toLowerCase()
    const name = parsed.name.toLowerCase()
    if (/vol|series|first partner/i.test(hintsJoined) || /vol|series|first partner/i.test(query)) {
      out.add(`${name} first partner`)
      out.add(`${name} first partner illustration`)
      out.add(`pokemon ${name} first partner`)
    }
  }

  if (parsed.mode === "name-set-combo" || parsed.mode === "set-or-name") {
    out.add(`pokemon ${trimmed}`)
    const comboTokens =
      parsed.mode === "name-set-combo" ? parsed.tokens : [parsed.name, ...parsed.hints]
    for (const { name, setHint } of buildNameSetCandidates(comboTokens)) {
      out.add(`${name} ${setHint}`)
      out.add(`pokemon ${name} ${setHint}`)
    }
    if (trimmed.includes("first partner")) {
      const name = comboTokens[0]?.toLowerCase()
      if (name) {
        out.add(`${name} first partner illustration`)
        out.add(`${name} black star promo`)
        out.add(`pokemon ${name} first partner`)
      }
    }
  }

  return [...out].slice(0, 8)
}

function scorePcCatalogHit(hit: PriceChartingSearchHit, query: string): number {
  const productName = (hit["product-name"] ?? "").toLowerCase()
  const consoleName = (hit["console-name"] ?? "").toLowerCase()
  const q = query.toLowerCase()
  let score = 0

  if (consoleName.includes("pokemon")) score += 4
  if (consoleName.includes("japanese")) score += 3

  const firstToken = q.split(/\s+/).find((token) => token.length >= 2) ?? ""
  if (firstToken && productName.startsWith(firstToken)) score += 15

  const looksLikeSealed =
    /\b(pack|collection|box|tin|bundle|deck|pin collection)\b/i.test(productName) &&
    !/#\d+/.test(productName)
  if (looksLikeSealed) score -= 25

  for (const token of q.split(/\s+/).filter(Boolean)) {
    if (token.length < 2) continue
    if (/^\d+$/.test(token)) {
      if (
        productName.includes(`#${token}`) ||
        productName.includes(` ${token}`) ||
        productName.includes(`${token}/`)
      ) {
        score += 10
      }
    } else if (productName.includes(token) || consoleName.includes(token)) {
      score += 6
    }
  }

  return score
}

async function searchPriceChartingCards(
  query: string,
  parsed: ParsedSearch,
  limit: number,
): Promise<CardSearchHit[]> {
  const apiKey = process.env.PRICECHARTING_API_KEY
  if (!apiKey || limit <= 0) return []

  const queries = buildPriceChartingCatalogQueries(query, parsed)
  const scored = new Map<string, { hit: CardSearchHit; score: number }>()

  const batches = [queries.slice(0, 2), queries.slice(2, 4), queries.slice(4, 6)].filter(
    (batch) => batch.length > 0,
  )

  for (const batch of batches) {
    const results = await Promise.all(
      batch.map(async (q) => {
        try {
          return await fetchPriceChartingProducts(apiKey, q)
        } catch {
          return []
        }
      }),
    )

    for (const hits of results) {
      for (const hit of hits) {
        const score = scorePcCatalogHit(hit, query)
        if (score < 6) continue
        const mapped = priceChartingHitToSearchHit(hit)
        if (!mapped) continue
        const existing = scored.get(mapped.id)
        if (!existing || score > existing.score) {
          scored.set(mapped.id, { hit: mapped, score })
        }
      }
    }

    if (scored.size >= limit) break
  }

  if (scored.size === 0) {
    for (const q of queries.slice(0, 4)) {
      try {
        const product = await fetchPriceChartingProduct(apiKey, { query: q })
        const hit = priceChartingHitToSearchHit({
          id: product.id,
          "product-name": product["product-name"],
          "console-name": product["console-name"],
        })
        if (hit) return [hit]
      } catch {
        /* try next query */
      }
    }
  }

  return [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.hit)
}

function expandSearchHints(hints: string[]): string[] {
  const expanded = new Set(hints)
  for (const hint of hints) {
    const lower = hint.toLowerCase().trim()
    if (/^(vol|volume|series)\s*1$/i.test(lower)) {
      expanded.add("first partner")
      expanded.add("series 1")
      expanded.add("first partner illustration")
    }
    if (/^(vol|volume|series)\s*2$/i.test(lower)) {
      expanded.add("series 2")
      expanded.add("first partner illustration")
    }
  }
  return [...expanded]
}

function dedupeCatalogCards(cards: CatalogCard[]): CatalogCard[] {
  const seen = new Set<string>()
  const out: CatalogCard[] = []
  for (const card of cards) {
    if (seen.has(card.id)) continue
    seen.add(card.id)
    out.push(card)
  }
  return out
}

async function fetchSupplementalPokemonForName(name: string, limit: number): Promise<CatalogCard[]> {
  const escaped = escapeLucene(name)
  const queries = [
    `name:${escaped} set.name:"First Partner"`,
    `name:${escaped} set.name:"SV Black Star Promos"`,
    `name:${escaped} set.name:"SVP"`,
    `name:${escaped} set.name:"Promo"`,
  ]
  const batches = await Promise.all(
    queries.map(async (query) => {
      try {
        return await fetchPokemonCardsByQuery(query, Math.min(limit, 25))
      } catch {
        return []
      }
    }),
  )
  return dedupeCatalogCards(batches.flat())
}

async function fetchPokemonCardsForParsed(parsed: ParsedSearch, limit: number): Promise<CatalogCard[]> {
  switch (parsed.mode) {
    case "number":
      return fetchByNumber(parsed.number, limit)
    case "set":
      return fetchBySet(parsed.setHint, parsed.setId, limit)
    case "set-number":
      return fetchBySetAndNumber(parsed.setHint, parsed.setId, parsed.number, limit)
    case "name": {
      const escaped = escapeLucene(parsed.name)
      const pageSize = Math.min(250, Math.max(limit * 3, 60))
      const [main, supplemental] = await Promise.all([
        fetchPokemonCardsByQuery(`name:${escaped}`, pageSize),
        fetchSupplementalPokemonForName(parsed.name, limit),
      ])
      return dedupeCatalogCards([...main, ...supplemental])
    }
    case "name-hints":
      return fetchCardsForHints(parsed.name, expandSearchHints(parsed.hints), limit)
    case "name-set-combo":
      return fetchNameSetCombos(parsed.tokens, limit)
    case "set-or-name": {
      const setCards = await fetchBySet(parsed.setHint, null, limit)
      if (setCards.length > 0) return setCards
      return fetchCardsForHints(parsed.name, expandSearchHints(parsed.hints), limit)
    }
    default:
      return []
  }
}

function dedupeSearchHitKey(hit: CardSearchHit): string {
  return `${normalizeToken(hit.cardName)}|${normalizeToken(hit.setName)}|${normalizeToken(hit.cardNumber)}`
}

function scoreSearchHit(hit: CardSearchHit, query: string): number {
  const productName = `${hit.cardName} ${hit.setName}`.toLowerCase()
  const q = query.toLowerCase()
  let score = 0

  const looksLikeSealed =
    /\b(pack|collection|box|tin|bundle|deck|pin collection)\b/i.test(productName) &&
    !/#\d+/.test(hit.cardName)
  if (looksLikeSealed) score -= 25

  const firstToken = q.split(/\s+/).find((token) => token.length >= 2) ?? ""
  if (firstToken && hit.cardName.toLowerCase().startsWith(firstToken)) score += 12

  for (const token of q.split(/\s+/).filter(Boolean)) {
    if (token.length < 2) continue
    if (/^\d+$/.test(token)) {
      if (
        productName.includes(`#${token}`) ||
        productName.includes(` ${token}`) ||
        productName.includes(`${token}/`) ||
        hit.cardNumber.startsWith(token)
      ) {
        score += 10
      }
    } else if (productName.includes(token)) {
      score += 6
    }
  }

  if (hit.imageUrl) score += 2
  if (productName.includes("first partner")) score += 4
  return score
}

function mergeAndRankSearchHits(hits: CardSearchHit[], query: string, limit: number): CardSearchHit[] {
  const byKey = new Map<string, { hit: CardSearchHit; score: number }>()

  for (const hit of hits) {
    const key = dedupeSearchHitKey(hit)
    const score = scoreSearchHit(hit, query)
    const existing = byKey.get(key)
    if (
      !existing ||
      score > existing.score ||
      (score === existing.score && hit.imageUrl && !existing.hit.imageUrl)
    ) {
      byKey.set(key, { hit, score })
    }
  }

  return [...byKey.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.hit)
}

export async function searchCatalogCards(query: string, limit = 12): Promise<CardSearchHit[]> {
  const parsed = parseSearchInput(query)
  if (parsed.mode === "empty") return []

  const [cards, priceChartingHits] = await Promise.all([
    fetchPokemonCardsForParsed(parsed, limit),
    searchPriceChartingCards(query, parsed, limit),
  ])

  const pokemonHits = cards.map(catalogToSearchHit)
  const merged = mergeAndRankSearchHits([...pokemonHits, ...priceChartingHits], query, limit)
  if (merged.length > 0) return merged

  if (parsed.mode === "name-set-combo" || parsed.mode === "set-or-name") {
    const name = parsed.mode === "name-set-combo" ? parsed.tokens[0] : parsed.name
    const setHint =
      parsed.mode === "name-set-combo" ? parsed.tokens.slice(1).join(" ") : parsed.hints.join(" ")

    if (name && setHint) {
      const narrowed = await searchPriceChartingCards(`${name} ${setHint}`, parsed, limit)
      if (narrowed.length > 0) return narrowed
    }

    if (name) {
      return searchPriceChartingCards(name, { mode: "name", name }, limit)
    }
  }

  return []
}

function formatCardName(name: string, rarity: string | null): string {
  if (!rarity) return name
  if (name.toLowerCase().includes(rarity.toLowerCase())) return name
  return `${name} (${rarity})`
}

function productToEntry(
  catalog: CatalogCard,
  product: Awaited<ReturnType<typeof resolvePriceChartingForCard>>["product"],
  pricechartingId?: string,
): MockCardEntry {
  const { rawPrice, grades } = extractCardPrices(product)
  const byGrade: Partial<Record<PsaGradeNumber, { slabPrice: number }>> = {}

  for (const { grade, price } of grades) {
    if (isPsaSlabGrade(grade) && price > 0) {
      byGrade[grade] = { slabPrice: price }
    }
  }

  const gradeQuotes = buildGradeQuotes(rawPrice, byGrade)
  const best = getBestGradeQuote(gradeQuotes)
  const id = pricechartingId ? `pc-${pricechartingId}` : `poke-${catalog.id}`

  return normalizeCardEntry({
    id,
    cardName: formatCardName(catalog.name, catalog.rarity),
    setName: catalog.setName,
    cardNumber: catalog.cardNumber,
    imageUrl: catalog.imageLarge ?? catalog.imageSmall ?? "",
    rawPrice,
    slabGrade: best?.grade ?? 8,
    slabPrice: best?.slabPrice ?? 0,
    deficit: best?.deficit ?? 0,
    percentageSavings: best?.percentageSavings ?? 0,
    marketInsight: pricechartingId
      ? "Live PSA 7–10 comps from PriceCharting."
      : "Card catalog match — add PriceCharting API key for slab pricing.",
    gradeQuotes,
    hasPricing: rawPrice > 0 || gradeQuotes.some((q) => q.slabPrice > 0),
  })
}

export async function lookupCardByPokemonId(
  pokemonTcgId: string,
  catalogContext?: LookupCatalogContext,
): Promise<MockCardEntry | null> {
  const cacheKey = `poke:${pokemonTcgId}`
  const cached = getCachedLookup(cacheKey)
  if (cached) return cached

  const catalog: CatalogCard | null = catalogContext
    ? {
        id: pokemonTcgId,
        name: catalogContext.cardName,
        setName: catalogContext.setName,
        cardNumber: catalogContext.cardNumber,
        rarity: catalogContext.rarity ?? null,
        imageSmall: catalogContext.imageUrl ?? null,
        imageLarge: catalogContext.imageUrl ?? null,
      }
    : await fetchPokemonCardById(pokemonTcgId)

  if (!catalog) return null

  const ctx: PriceChartingCardContext = {
    cardName: catalog.name,
    setName: catalog.setName,
    cardNumber: catalog.cardNumber,
  }

  const apiKey = process.env.PRICECHARTING_API_KEY
  if (!apiKey) {
    return normalizeCardEntry({
      id: `poke-${catalog.id}`,
      cardName: formatCardName(catalog.name, catalog.rarity),
      setName: catalog.setName,
      cardNumber: catalog.cardNumber,
      imageUrl: catalog.imageLarge ?? catalog.imageSmall ?? "",
      rawPrice: 0,
      slabGrade: 8,
      slabPrice: 0,
      deficit: 0,
      percentageSavings: 0,
      marketInsight: "Pricing unavailable — set PRICECHARTING_API_KEY on the server.",
      gradeQuotes: buildGradeQuotes(0, {}),
      hasPricing: false,
    })
  }

  try {
    const { product, resolvedId } = await resolvePriceChartingForCard(apiKey, ctx)
    const entry = productToEntry(catalog, product, resolvedId)
    setCachedLookup(cacheKey, entry)
    return entry
  } catch {
    const entry = productToEntry(
      catalog,
      {
        "product-name": catalog.name,
        "console-name": catalog.setName,
      },
      undefined,
    )
    setCachedLookup(cacheKey, entry)
    return entry
  }
}

export async function lookupCardById(cardId: string): Promise<MockCardEntry | null> {
  if (cardId.startsWith("poke-")) {
    return lookupCardByPokemonId(cardId.replace(/^poke-/, ""))
  }

  if (cardId.startsWith("pc-")) {
    const apiKey = process.env.PRICECHARTING_API_KEY
    if (!apiKey) return null

    const pcId = cardId.replace(/^pc-/, "")
    const { fetchPriceChartingProduct } = await import("@/lib/pricecharting")
    const product = await fetchPriceChartingProduct(apiKey, { id: pcId })

    const catalog: CatalogCard = {
      id: `pc-${pcId}`,
      name: product["product-name"] ?? "Unknown card",
      setName: product["console-name"] ?? "Unknown set",
      cardNumber: "",
      rarity: null,
      imageSmall: null,
      imageLarge: null,
    }

    return productToEntry(catalog, product, pcId)
  }

  return null
}
