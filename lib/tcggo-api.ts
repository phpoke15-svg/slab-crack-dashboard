/**
 * Pokémon TCG API on RapidAPI (pokemon-api.com / TCGGO).
 * Docs: https://www.pokemon-api.com/docs/
 * Subscribe: https://rapidapi.com/tcggopro/api/pokemon-tcg-api
 */

const DEFAULT_HOST = "pokemon-tcg-api.p.rapidapi.com"
const DEFAULT_BASE_URL = `https://${DEFAULT_HOST}`

export type TcgGoGradedMedian = {
  median_price?: number
  sample_size?: number
}

export type TcgGoCardPrices = {
  cardmarket?: {
    currency?: string
    lowest_near_mint?: number
    "30d_average"?: number
    "7d_average"?: number
    graded?: {
      psa?: {
        psa10?: number
        psa9?: number
      }
    }
  }
  ebay?: {
    currency?: string
    graded?: {
      psa?: Record<string, TcgGoGradedMedian>
    }
  }
  tcg_player?: {
    currency?: string
    market_price?: number
    mid_price?: number
  }
}

export type TcgGoCard = {
  id?: number
  name?: string
  name_numbered?: string
  card_code_number?: string
  card_number?: number | string
  tcgid?: string
  tcgplayer_id?: number
  cardmarket_id?: number
  rarity?: string | null
  image?: string | null
  prices?: TcgGoCardPrices
  episode?: { id?: number; name?: string; code?: string }
}

export type TcgGoHistoryPoint = {
  date: string
  grade: number
  price: number
  saleCount?: number
}

export type TcgGoFetchedPrices = {
  rawPrice: number
  psa7Price: number
  psa8Price: number
  psa9Price: number
  psa10Price: number
  tcgGoId?: number
  tcgId?: string
}

type TcgGoRequestOptions = {
  apiKey?: string
  host?: string
  baseUrl?: string
}

function tcgGoHost(options?: TcgGoRequestOptions): string {
  return options?.host ?? process.env.RAPIDAPI_POKEMON_TCG_HOST?.trim() ?? DEFAULT_HOST
}

function tcgGoBaseUrl(options?: TcgGoRequestOptions): string {
  return options?.baseUrl ?? `https://${tcgGoHost(options)}`
}

function tcgGoApiKey(options?: TcgGoRequestOptions): string {
  const key = options?.apiKey ?? process.env.RAPIDAPI_POKEMON_TCG_KEY?.trim()
  if (!key) throw new Error("RAPIDAPI_POKEMON_TCG_KEY is not configured")
  return key
}

function parsePositiveNumber(value: unknown): number {
  if (value == null || value === "") return 0
  const num = typeof value === "string" ? Number.parseFloat(value) : Number(value)
  if (!Number.isFinite(num) || num <= 0) return 0
  return num
}

/** poke-sv3pt5-173 → sv3pt5-173; also accepts bare tcgid. */
export function pokemonTcgIdFromCardId(cardId: string): string | undefined {
  if (cardId.startsWith("poke-")) return cardId.slice("poke-".length)
  if (cardId.includes("-") && !cardId.startsWith("pc-")) return cardId
  return undefined
}

export function catalogIdFromTcgGoCard(card: TcgGoCard): string {
  const tcgId = card.tcgid?.trim()
  if (tcgId) return `poke-${tcgId}`
  if (card.id != null) return `poke-tcggo-${card.id}`
  return "poke-unknown"
}

export function tcgGoCardImageUrl(card: TcgGoCard): string | null {
  const image = card.image?.trim()
  return image || null
}

export function tcgGoCardNumber(card: TcgGoCard): string {
  if (typeof card.card_number === "number") return String(card.card_number)
  if (typeof card.card_number === "string" && card.card_number.trim()) return card.card_number.trim()
  const coded = card.card_code_number?.trim()
  if (coded) {
    const match = coded.match(/(\d+[a-zA-Z]?)$/)
    if (match) return match[1]!
    return coded
  }
  return ""
}

export function tcgGoCardSetName(card: TcgGoCard): string {
  return card.episode?.name?.trim() || "Unknown Set"
}

/** Map TCGGO card → shared catalog shape used by scanners and lookup. */
export function tcgGoCardToCatalogCard(card: TcgGoCard): {
  id: string
  name: string
  setName: string
  cardNumber: string
  rarity: string | null
  imageSmall: string | null
  imageLarge: string | null
  tcgGoId?: number
} {
  const image = tcgGoCardImageUrl(card)
  return {
    id: card.tcgid ?? String(card.id ?? ""),
    name: card.name ?? "Unknown",
    setName: tcgGoCardSetName(card),
    cardNumber: tcgGoCardNumber(card),
    rarity: card.rarity ?? null,
    imageSmall: image,
    imageLarge: image,
    tcgGoId: card.id,
  }
}

export function extractTcgGoCardPrices(card: TcgGoCard): TcgGoFetchedPrices {
  const tcg = card.prices?.tcg_player
  const ebayPsa = card.prices?.ebay?.graded?.psa
  const cmPsa = card.prices?.cardmarket?.graded?.psa

  const rawPrice =
    parsePositiveNumber(tcg?.market_price) ||
    parsePositiveNumber(tcg?.mid_price) ||
    parsePositiveNumber(card.prices?.cardmarket?.["7d_average"]) ||
    parsePositiveNumber(card.prices?.cardmarket?.lowest_near_mint)

  const psa10 =
    parsePositiveNumber(ebayPsa?.["10"]?.median_price) ||
    parsePositiveNumber(ebayPsa?.["10"]) ||
    parsePositiveNumber(cmPsa?.psa10)

  const psa9 =
    parsePositiveNumber(ebayPsa?.["9"]?.median_price) ||
    parsePositiveNumber(ebayPsa?.["9"]) ||
    parsePositiveNumber(cmPsa?.psa9)

  const psa8 =
    parsePositiveNumber(ebayPsa?.["8"]?.median_price) ||
    parsePositiveNumber(ebayPsa?.["8"])

  const psa7 =
    parsePositiveNumber(ebayPsa?.["7"]?.median_price) ||
    parsePositiveNumber(ebayPsa?.["7"])

  return {
    rawPrice,
    psa7Price: psa7,
    psa8Price: psa8,
    psa9Price: psa9,
    psa10Price: psa10,
    tcgGoId: card.id,
    tcgId: card.tcgid,
  }
}

function unwrapCard(payload: unknown): TcgGoCard | null {
  if (!payload || typeof payload !== "object") return null
  const record = payload as Record<string, unknown>
  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
    return record.data as TcgGoCard
  }
  if (record.id != null) return record as TcgGoCard
  return unwrapCardList(payload)[0] ?? null
}

function unwrapCardList(payload: unknown): TcgGoCard[] {
  if (Array.isArray(payload)) return payload as TcgGoCard[]
  if (!payload || typeof payload !== "object") return []

  const record = payload as Record<string, unknown>
  for (const key of ["data", "cards", "results", "items"]) {
    const value = record[key]
    if (Array.isArray(value)) return value as TcgGoCard[]
  }

  if (record.id != null) return [record as TcgGoCard]
  return []
}

function unwrapHistoryRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== "object") return []

  const record = payload as Record<string, unknown>
  for (const key of ["data", "history", "prices", "results", "items"]) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function parseHistoryDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const date = value.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

function historyPriceFromRow(row: Record<string, unknown>, grade: number): number {
  if (grade === 0) {
    return (
      parsePositiveNumber(row.tcg_player_market) ||
      parsePositiveNumber(row.market_price) ||
      parsePositiveNumber(row.tcg_player_market_price) ||
      parsePositiveNumber(row.tcgplayer_market_price) ||
      parsePositiveNumber(row.cm_low) ||
      parsePositiveNumber(row.lowest_near_mint) ||
      parsePositiveNumber(row.price) ||
      parsePositiveNumber(row.average_price)
    )
  }

  if (grade === 7) {
    return parsePositiveNumber(row.psa7_price) || parsePositiveNumber(row.ebay_psa7)
  }

  if (grade === 8) {
    return parsePositiveNumber(row.psa8_price) || parsePositiveNumber(row.ebay_psa8)
  }

  if (grade === 9) {
    return (
      parsePositiveNumber(row.psa9_price) ||
      parsePositiveNumber(row.psa_9_price) ||
      parsePositiveNumber(row.grade_9_price) ||
      parsePositiveNumber(row.ebay_psa9)
    )
  }

  if (grade === 10) {
    return (
      parsePositiveNumber(row.psa10_price) ||
      parsePositiveNumber(row.psa_10_price) ||
      parsePositiveNumber(row.grade_10_price) ||
      parsePositiveNumber(row.ebay_psa10)
    )
  }

  return 0
}

function parseDateKeyedHistory(data: Record<string, unknown>): TcgGoHistoryPoint[] {
  const points: TcgGoHistoryPoint[] = []

  for (const [dateKey, value] of Object.entries(data)) {
    const date = parseHistoryDate(dateKey)
    if (!date || !value || typeof value !== "object") continue
    const row = value as Record<string, unknown>
    const price = historyPriceFromRow(row, 0)
    if (price <= 0) continue
    points.push({ date, grade: 0, price })
  }

  return points
}

export function parseTcgGoHistoryPoints(payload: unknown): TcgGoHistoryPoint[] {
  if (!payload || typeof payload !== "object") return []

  const record = payload as Record<string, unknown>
  const data = record.data

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const dateKeyed = parseDateKeyedHistory(data as Record<string, unknown>)
    if (dateKeyed.length > 0) {
      return dateKeyed.sort((a, b) => a.date.localeCompare(b.date))
    }
  }

  const rows = Array.isArray(data)
    ? data
    : Array.isArray(payload)
      ? payload
      : unwrapHistoryRows(payload)

  const points: TcgGoHistoryPoint[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const entry = row as Record<string, unknown>
    const date =
      parseHistoryDate(entry.date) ??
      parseHistoryDate(entry.snapshot_date) ??
      parseHistoryDate(entry.captured_at)

    if (!date) continue

    const explicitGrade = Number(entry.grade ?? entry.psa_grade)
    const grades =
      Number.isFinite(explicitGrade) && explicitGrade >= 0 ? [explicitGrade] : [0, 9, 10]

    for (const grade of grades) {
      const price = historyPriceFromRow(entry, grade)
      if (price <= 0) continue
      const key = `${date}|${grade}`
      if (seen.has(key)) continue
      seen.add(key)
      points.push({
        date,
        grade,
        price,
        saleCount:
          typeof entry.sale_count === "number"
            ? entry.sale_count
            : typeof entry.sample_size === "number"
              ? entry.sample_size
              : undefined,
      })
    }
  }

  return points.sort((a, b) => a.date.localeCompare(b.date))
}

async function tcgGoFetch<T>(
  path: string,
  searchParams?: Record<string, string | number | undefined>,
  options?: TcgGoRequestOptions,
): Promise<T> {
  const url = new URL(path, tcgGoBaseUrl(options))
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value == null || value === "") continue
      url.searchParams.set(key, String(value))
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      "x-rapidapi-key": tcgGoApiKey(options),
      "x-rapidapi-host": tcgGoHost(options),
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`TCGGO API ${response.status}: ${body.slice(0, 200) || response.statusText}`)
  }

  return (await response.json()) as T
}

export async function fetchTcgGoCardByTcgId(
  tcgId: string,
  options?: TcgGoRequestOptions,
): Promise<TcgGoCard | null> {
  const payload = await tcgGoFetch<unknown>("/cards", { tcgid: tcgId, per_page: 1 }, options)
  const cards = unwrapCardList(payload)
  return cards[0] ?? null
}

export async function searchTcgGoCards(
  params: {
    search?: string
    name?: string
    cardNumber?: string
    tcgId?: string
    perPage?: number
  },
  options?: TcgGoRequestOptions,
): Promise<TcgGoCard[]> {
  const payload = await tcgGoFetch<unknown>(
    "/cards",
    {
      search: params.search,
      name: params.name,
      card_number: params.cardNumber,
      tcgid: params.tcgId,
      per_page: params.perPage ?? 20,
      sort: "relevance",
    },
    options,
  )
  return unwrapCardList(payload)
}

export async function fetchTcgGoCardById(
  tcgGoId: number,
  options?: TcgGoRequestOptions,
): Promise<TcgGoCard | null> {
  try {
    const payload = await tcgGoFetch<unknown>(`/cards/${tcgGoId}`, undefined, options)
    return unwrapCard(payload)
  } catch {
    return null
  }
}

export async function fetchTcgGoCardsByTcgIds(
  tcgIds: string[],
  options?: TcgGoRequestOptions,
): Promise<TcgGoCard[]> {
  const ids = [...new Set(tcgIds.map((id) => id.trim()).filter(Boolean))].slice(0, 20)
  if (ids.length === 0) return []

  const payload = await tcgGoFetch<unknown>(
    "/cards",
    { tcgids: ids.join(","), per_page: ids.length },
    options,
  )
  return unwrapCardList(payload)
}

export async function fetchTcgGoCatalogPage(
  page: number,
  perPage = 50,
  options?: TcgGoRequestOptions,
): Promise<{ cards: TcgGoCard[]; totalCount: number; pageSize: number }> {
  const payload = await tcgGoFetch<unknown>(
    "/cards",
    { page, per_page: perPage, sort: "-released_at" },
    options,
  )
  const cards = unwrapCardList(payload)
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}
  const paging =
    record.paging && typeof record.paging === "object"
      ? (record.paging as Record<string, unknown>)
      : {}
  const totalCount = Number(record.results ?? paging.total ?? cards.length)
  const pageSize = Number(paging.per_page ?? perPage)

  return { cards, totalCount: Number.isFinite(totalCount) ? totalCount : cards.length, pageSize }
}

export async function resolveTcgGoCardForTarget(input: {
  cardId: string
  cardName: string
  setName: string
  cardNumber?: string
  tcgGoId?: number
}): Promise<TcgGoCard | null> {
  if (input.tcgGoId) {
    const byId = await fetchTcgGoCardById(input.tcgGoId)
    if (byId) return byId
  }

  const tcgId = pokemonTcgIdFromCardId(input.cardId)
  if (tcgId) {
    const byTcgId = await fetchTcgGoCardByTcgId(tcgId)
    if (byTcgId) return byTcgId
  }

  const number = input.cardNumber?.split("/")[0]?.replace(/^#/, "").trim()
  const searchParts = [input.cardName, number, input.setName].filter(Boolean)
  const search = searchParts.join(" ").trim()
  if (!search) return null

  const hits = await searchTcgGoCards({
    search,
    name: input.cardName,
    cardNumber: number,
    perPage: 10,
  })

  if (hits.length === 0) return null

  const normalizedName = input.cardName.toLowerCase().replace(/\s+/g, " ").trim()
  const normalizedSet = input.setName.toLowerCase()

  const ranked = hits
    .map((card) => {
      let score = 0
      const cardName = (card.name ?? "").toLowerCase()
      const setName = (card.episode?.name ?? "").toLowerCase()
      if (cardName === normalizedName) score += 20
      else if (cardName.startsWith(normalizedName)) score += 10
      if (normalizedSet && setName.includes(normalizedSet)) score += 8
      if (number && (card.card_code_number ?? "").includes(number)) score += 12
      if (tcgId && card.tcgid === tcgId) score += 30
      return { card, score }
    })
    .sort((a, b) => b.score - a.score)

  return ranked[0]?.card ?? hits[0] ?? null
}

export async function fetchTcgGoHistoryPrices(input: {
  tcgGoId?: number
  tcgId?: string
  cardmarketId?: number
  dateFrom: string
  dateTo: string
  page?: number
}): Promise<{ points: TcgGoHistoryPoint[]; hasMore: boolean }> {
  const page = input.page ?? 1
  const query = {
    id: input.tcgGoId,
    tcgid: input.tcgId,
    cardmarket_id: input.cardmarketId,
    date_from: input.dateFrom,
    date_to: input.dateTo,
    page,
    sort: "asc",
  }

  let payload: unknown
  try {
    payload = await tcgGoFetch<unknown>("/history-prices", query)
  } catch (error) {
    if (!input.tcgGoId) throw error
    payload = await tcgGoFetch<unknown>(`/cards/${input.tcgGoId}/history-prices`, {
      date_from: input.dateFrom,
      date_to: input.dateTo,
      page,
      sort: "asc",
    })
  }

  const points = parseTcgGoHistoryPoints(payload)
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}
  const paging =
    record.paging && typeof record.paging === "object"
      ? (record.paging as Record<string, unknown>)
      : {}
  const currentPage = Number(paging.current ?? record.page ?? page)
  const totalPages = Number(paging.total ?? record.last_page ?? record.total_pages ?? currentPage)
  const hasMore = Number.isFinite(totalPages) && currentPage < totalPages

  return { points, hasMore }
}

export async function fetchAllTcgGoHistoryPrices(input: {
  tcgGoId?: number
  tcgId?: string
  cardmarketId?: number
  dateFrom: string
  dateTo: string
  maxPages?: number
}): Promise<TcgGoHistoryPoint[]> {
  const maxPages = input.maxPages ?? 5
  const merged = new Map<string, TcgGoHistoryPoint>()

  for (let page = 1; page <= maxPages; page++) {
    const { points, hasMore } = await fetchTcgGoHistoryPrices({ ...input, page })
    for (const point of points) {
      merged.set(`${point.date}|${point.grade}`, point)
    }
    if (!hasMore || points.length === 0) break
  }

  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** Replace catalog images with pokemon-api.com artwork when available. */
export async function enrichHitsWithTcgGoImages<
  T extends { id: string; imageUrl?: string | null; image?: string | null },
>(hits: T[], limit = 12): Promise<T[]> {
  if (!process.env.RAPIDAPI_POKEMON_TCG_KEY?.trim() || hits.length === 0) return hits

  const slice = hits.slice(0, limit)
  const tcgIds = slice
    .map((hit) => pokemonTcgIdFromCardId(hit.id))
    .filter((id): id is string => Boolean(id))
  if (tcgIds.length === 0) return hits

  try {
    const cards = await fetchTcgGoCardsByTcgIds(tcgIds)
    const imageByTcgId = new Map<string, string>()
    for (const card of cards) {
      const tcgId = card.tcgid
      const image = tcgGoCardImageUrl(card)
      if (tcgId && image) imageByTcgId.set(tcgId, image)
    }

    return hits.map((hit) => {
      const tcgId = pokemonTcgIdFromCardId(hit.id)
      const image = tcgId ? imageByTcgId.get(tcgId) : undefined
      if (!image) return hit
      if ("imageUrl" in hit) return { ...hit, imageUrl: image }
      if ("image" in hit) return { ...hit, image }
      return hit
    })
  } catch {
    return hits
  }
}
