import { toCatalogId, proxiedScrydexImageUrl } from "@/lib/scrydex/constants"
import type {
  CatalogCardRow,
  ScrydexCard,
  ScrydexExpansionRef,
  ScrydexHistoryPoint,
  ScrydexVariant,
  ScrydexVisionResponse,
  ScrydexVisionResult,
  TcgGame,
} from "@/lib/scrydex/types"

function pickFrontImage(images?: ScrydexCard["images"]) {
  const front = images?.find((img) => img.type === "front") ?? images?.[0]
  return {
    small: proxiedScrydexImageUrl(front?.small ?? front?.medium),
    large: proxiedScrydexImageUrl(front?.large ?? front?.medium ?? front?.small),
  }
}

function normalizeGame(value: string | undefined): TcgGame | null {
  const v = value?.toLowerCase().trim()
  if (v === "pokemon") return "pokemon"
  if (v === "lorcana") return "lorcana"
  if (v === "mtg" || v === "magicthegathering" || v === "magic") return "mtg"
  return null
}

export function scrydexCardToRow(game: TcgGame, card: ScrydexCard | Record<string, unknown>): CatalogCardRow {
  const raw = card as ScrydexCard
  const scrydexId = String(raw.id ?? "").trim()
  const expansion = raw.expansion ?? {}
  const images = pickFrontImage(raw.images)
  const variants = (raw.variants ?? []).map((v) => v.name).filter(Boolean) as string[]

  return {
    catalog_id: toCatalogId(game, scrydexId),
    game,
    scrydex_id: scrydexId,
    name: String(raw.name ?? "Unknown card").trim(),
    set_code: String(expansion.id ?? expansion.code ?? "unknown").trim(),
    set_name: String(expansion.name ?? "Unknown set").trim(),
    number: String(raw.number ?? "").trim(),
    printed_number: raw.printed_number ?? null,
    rarity: raw.rarity ?? null,
    supertype: raw.supertype ?? null,
    subtypes: raw.subtypes ?? [],
    language_code: raw.language_code ?? "EN",
    image_small_url: images.small,
    image_large_url: images.large,
    variants,
    metadata: {
      ...(raw.metadata ?? {}),
      expansion,
    },
  }
}

export function scrydexExpansionToRow(game: TcgGame, expansion: ScrydexExpansionRef | Record<string, unknown>) {
  const raw = expansion as ScrydexExpansionRef
  const id = String(raw.id ?? raw.code ?? "").trim()
  if (!id) return null

  const release = raw.release_date?.replace(/\//g, "-")
  return {
    id,
    game,
    name: String(raw.name ?? id).trim(),
    series: raw.series ?? null,
    release_date: release && release.length >= 8 ? release : null,
    total_cards: raw.total ?? raw.printed_total ?? null,
    language_code: raw.language_code ?? "EN",
    is_online_only: Boolean(raw.is_online_only),
    metadata: raw,
  }
}

function dedupeRows<T extends Record<string, unknown>>(rows: T[], keyFn: (row: T) => string): T[] {
  const byKey = new Map<string, T>()
  for (const row of rows) {
    byKey.set(keyFn(row), row)
  }
  return [...byKey.values()]
}

export function extractRawPrices(catalogId: string, variants: ScrydexVariant[] | undefined) {
  const rows: Array<Record<string, unknown>> = []
  const now = new Date().toISOString()

  for (const variant of variants ?? []) {
    const variantName = variant.name ?? "normal"
    for (const price of variant.prices ?? []) {
      if (price.type && price.type !== "raw") continue
      rows.push({
        catalog_id: catalogId,
        variant: variantName,
        condition: price.condition ?? "NM",
        currency: price.currency ?? "USD",
        market_price: price.market ?? null,
        low_price: price.low ?? null,
        mid_price: price.mid ?? null,
        source: "scrydex",
        synced_at: now,
      })
    }
  }

  return dedupeRows(rows, (row) => `${row.catalog_id}|${row.variant}|${row.condition}`)
}

export function extractGradedPrices(catalogId: string, variants: ScrydexVariant[] | undefined) {
  const rows: Array<Record<string, unknown>> = []
  const now = new Date().toISOString()

  for (const variant of variants ?? []) {
    const variantName = variant.name ?? "normal"
    for (const price of variant.prices ?? []) {
      if (price.type !== "graded" && !price.company) continue
      if (!price.company || !price.grade) continue
      rows.push({
        catalog_id: catalogId,
        variant: variantName,
        company: price.company,
        grade: String(price.grade),
        currency: price.currency ?? "USD",
        market_price: price.market ?? null,
        low_price: price.low ?? null,
        source: "scrydex",
        synced_at: now,
      })
    }
  }

  return dedupeRows(rows, (row) => `${row.catalog_id}|${row.variant}|${row.company}|${row.grade}`)
}

export function extractPopulationReports(catalogId: string, variants: ScrydexVariant[] | undefined) {
  const rows: Array<Record<string, unknown>> = []
  const now = new Date().toISOString()

  for (const variant of variants ?? []) {
    const variantName = variant.name ?? "normal"
    for (const pop of variant.pop_reports ?? []) {
      const company = pop.company ?? "PSA"
      for (const gradeRow of pop.grades ?? []) {
        if (!gradeRow.grade) continue
        rows.push({
          catalog_id: catalogId,
          variant: variantName,
          company,
          grade: String(gradeRow.grade),
          count: gradeRow.count ?? 0,
          grade_total: pop.grade_total ?? null,
          pop_total: pop.total ?? null,
          synced_at: now,
        })
      }
    }
  }

  return dedupeRows(rows, (row) => `${row.catalog_id}|${row.variant}|${row.company}|${row.grade}`)
}

export function flattenHistoryPoints(
  catalogId: string,
  payload: ScrydexHistoryPoint[] | Array<{ date?: string; prices?: ScrydexHistoryPoint[] }> | undefined,
) {
  const rows: Array<Record<string, unknown>> = []
  const now = new Date().toISOString()

  for (const entry of payload ?? []) {
    if ("prices" in entry && Array.isArray(entry.prices)) {
      for (const point of entry.prices) {
        rows.push(historyPointToRow(catalogId, entry.date ?? point.date, point, now))
      }
      continue
    }
    rows.push(historyPointToRow(catalogId, entry.date, entry as ScrydexHistoryPoint, now))
  }

  return rows.filter((row) => Number(row.market_price) > 0)
}

function historyPointToRow(
  catalogId: string,
  date: string | undefined,
  point: ScrydexHistoryPoint,
  capturedAt: string,
) {
  const priceType = point.type === "graded" || point.company ? "graded" : "raw"
  return {
    catalog_id: catalogId,
    snapshot_date: date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    price_type: priceType,
    variant: point.variant ?? "normal",
    condition: priceType === "raw" ? point.condition ?? "NM" : null,
    company: priceType === "graded" ? point.company ?? null : null,
    grade: priceType === "graded" ? point.grade ?? null : null,
    market_price: point.market ?? 0,
    low_price: point.low ?? null,
    currency: point.currency ?? "USD",
    source: "scrydex",
    captured_at: capturedAt,
  }
}

export function visionResultToCatalog(gameHint: TcgGame | undefined, result: ScrydexVisionResult) {
  const game = normalizeGame(result.game) ?? gameHint
  const scrydexId = String(result.id ?? result.card_id ?? "").trim()
  if (!game || !scrydexId) return null

  const catalogId = toCatalogId(game, scrydexId)
  const images = pickFrontImage(undefined)
  return {
    catalog_id: catalogId,
    game,
    scrydex_id: scrydexId,
    name: String(result.name ?? "Unknown card").trim(),
    set_code: String(result.expansion?.id ?? result.expansion?.code ?? "unknown").trim(),
    set_name: String(result.expansion?.name ?? "Unknown set").trim(),
    number: "",
    image_small_url: images.small,
    image_large_url: images.large,
    metadata: { vision: result },
  } satisfies Partial<CatalogCardRow>
}

/** Map Scrydex Vision `/vision/v1/cards/identify` response to a catalog row. */
export function visionResponseToCatalog(
  gameHint: TcgGame | undefined,
  response: ScrydexVisionResponse,
): (Partial<CatalogCardRow> & { confidence?: number }) | null {
  const data = response.data
  const match = data?.matches?.[0]
  const card = match?.card
  if (!card?.id) return null

  const game = normalizeGame(data?.analysis?.game) ?? gameHint
  if (!game) return null

  const row = scrydexCardToRow(game, card)
  return {
    ...row,
    metadata: {
      ...(row.metadata ?? {}),
      vision: { analysis: data?.analysis, match },
    },
    confidence: match.score,
  }
}

export function parseRemoteCardList(game: TcgGame, payload: Record<string, unknown>[]) {
  return payload.map((row) => scrydexCardToRow(game, row as ScrydexCard))
}

export { normalizeGame }
