/** Supported TCG games in CollecTools Scrydex pipeline. */
export type TcgGame = "pokemon" | "lorcana" | "mtg"

export type CatalogId = `${TcgGame}-${string}`

export type ScrydexCreditCost = 1 | 3 | 5

export type CachePolicy = {
  metadataTtlMs: number
  priceTtlMs: number
  historyTtlMs: number
}

export const SCRYDEX_CACHE: CachePolicy = {
  metadataTtlMs: Number.POSITIVE_INFINITY,
  priceTtlMs: 24 * 60 * 60 * 1000,
  historyTtlMs: 7 * 24 * 60 * 60 * 1000,
}

export type ScrydexImage = {
  type?: string
  small?: string
  medium?: string
  large?: string
}

export type ScrydexExpansionRef = {
  id?: string
  name?: string
  code?: string
  series?: string
  total?: number
  printed_total?: number
  release_date?: string
  language_code?: string
  is_online_only?: boolean
}

export type ScrydexVariantPrice = {
  type?: string
  condition?: string
  market?: number
  low?: number
  mid?: number
  currency?: string
  company?: string
  grade?: string
}

export type ScrydexVariant = {
  name?: string
  images?: ScrydexImage[]
  prices?: ScrydexVariantPrice[]
  pop_reports?: Array<{
    company?: string
    total?: number
    grade_total?: number
    grades?: Array<{ grade?: string; count?: number }>
  }>
}

export type ScrydexCard = {
  id: string
  name: string
  number?: string
  printed_number?: string
  rarity?: string | null
  supertype?: string | null
  subtypes?: string[]
  language_code?: string
  images?: ScrydexImage[]
  expansion?: ScrydexExpansionRef
  variants?: ScrydexVariant[]
  metadata?: Record<string, unknown>
}

export type ScrydexListResponse<T> = {
  data?: T[]
  page?: number
  page_size?: number
  pageSize?: number
  count?: number
  total_count?: number
  totalCount?: number
}

export type ScrydexCardResponse = {
  data?: ScrydexCard
}

export type ScrydexHistoryPoint = {
  date?: string
  variant?: string
  condition?: string
  type?: string
  company?: string
  grade?: string
  market?: number
  low?: number
  currency?: string
}

export type ScrydexHistoryResponse = {
  data?: ScrydexHistoryPoint[] | Array<{ date?: string; prices?: ScrydexHistoryPoint[] }>
  page?: number
  page_size?: number
  total_count?: number
}

export type ScrydexVisionResult = {
  type?: string
  game?: string
  id?: string
  card_id?: string
  name?: string
  confidence?: number
  expansion?: ScrydexExpansionRef
  graded_details?: {
    company?: string
    grade_number?: string
  }
}

export type ScrydexVisionResponse = {
  data?: ScrydexVisionResult
}

export type CatalogCardRow = {
  catalog_id: string
  game: TcgGame
  scrydex_id: string
  name: string
  set_code: string
  set_name: string
  number: string
  printed_number?: string | null
  rarity?: string | null
  supertype?: string | null
  subtypes?: string[]
  language_code?: string | null
  image_small_url?: string | null
  image_large_url?: string | null
  variants?: string[]
  metadata?: Record<string, unknown>
}

export type CardPriceBundle = {
  card: CatalogCardRow
  raw: Array<Record<string, unknown>>
  graded: Array<Record<string, unknown>>
  population: Array<Record<string, unknown>>
  history: Array<Record<string, unknown>>
  creditsUsed: number
}

export type CreditLedgerEntry = {
  endpoint: string
  credits: number
  game?: TcgGame
  catalogId?: string
  jobId?: string
}
