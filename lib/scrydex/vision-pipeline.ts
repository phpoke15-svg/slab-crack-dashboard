import { createHash } from "node:crypto"
import {
  extractGradedPrices,
  extractPopulationReports,
  extractRawPrices,
  scrydexCardToRow,
  visionResponseToCatalog,
} from "@/lib/scrydex/adapters"
import { ScrydexClient } from "@/lib/scrydex/client"
import {
  getCatalogCard,
  getVisionCache,
  loadCardBundle,
  persistCardPricingBundle,
  saveVisionCache,
  upsertCatalogCards,
} from "@/lib/scrydex/db"
import type { CardPriceBundle, CatalogCardRow, ScrydexCard, TcgGame } from "@/lib/scrydex/types"

export function hashScanImage(imageBase64: string): string {
  return createHash("sha256").update(imageBase64).digest("hex").slice(0, 40)
}

/** Scrydex Vision fails when multiple games are sent in one request — scope to one game. */
export function visionScanGameScope(preferredGame: TcgGame): TcgGame[] {
  return [preferredGame]
}

export class ScrydexVisionNoMatchError extends Error {
  constructor(message = "Scrydex Vision returned no match") {
    super(message)
    this.name = "ScrydexVisionNoMatchError"
  }
}

type VisionCatalogPartial = Partial<CatalogCardRow> & {
  catalog_id: string
  game: TcgGame
  scrydex_id: string
  confidence?: number
}

function partialToCatalogRow(partial: VisionCatalogPartial): CatalogCardRow {
  return {
    catalog_id: partial.catalog_id,
    game: partial.game,
    scrydex_id: partial.scrydex_id,
    name: partial.name ?? "Unknown card",
    set_code: partial.set_code ?? "unknown",
    set_name: partial.set_name ?? "Unknown set",
    number: partial.number ?? "",
    printed_number: partial.printed_number ?? null,
    rarity: partial.rarity ?? null,
    supertype: partial.supertype ?? null,
    subtypes: partial.subtypes ?? [],
    language_code: partial.language_code ?? "EN",
    image_small_url: partial.image_small_url ?? null,
    image_large_url: partial.image_large_url ?? null,
    variants: partial.variants ?? [],
    metadata: partial.metadata ?? {},
  }
}

function bundleFromVisionCard(game: TcgGame, visionCard: ScrydexCard): CardPriceBundle {
  const row = scrydexCardToRow(game, visionCard)
  return {
    card: row,
    raw: extractRawPrices(row.catalog_id, visionCard.variants),
    graded: extractGradedPrices(row.catalog_id, visionCard.variants),
    population: extractPopulationReports(row.catalog_id, visionCard.variants),
    history: [],
    creditsUsed: 0,
  }
}

async function ensureCatalogCardAfterVision(
  client: ScrydexClient,
  partial: VisionCatalogPartial,
): Promise<CatalogCardRow> {
  const existing = await getCatalogCard(partial.catalog_id)
  if (existing) return existing

  try {
    const remote = await client.getCard(partial.game, partial.scrydex_id, {
      includePrices: true,
      catalogId: partial.catalog_id,
    })
    if (remote.data) {
      return await persistCardPricingBundle(partial.game, remote.data)
    }
  } catch (error) {
    console.warn(
      "[vision] catalog card fetch failed:",
      error instanceof Error ? error.message : error,
    )
  }

  const fallbackRow = partialToCatalogRow(partial)
  try {
    await upsertCatalogCards([fallbackRow])
    const loaded = await getCatalogCard(partial.catalog_id)
    if (loaded) return loaded
  } catch (error) {
    console.warn("[vision] catalog upsert failed:", error instanceof Error ? error.message : error)
  }

  return fallbackRow
}

/** Vision scan → local bundle. Novel scan = 5 credits; repeat phash = 0 credits. */
export async function resolveScanToCatalog(input: {
  imageBase64: string
  preferredGames?: TcgGame[]
}): Promise<CardPriceBundle & { source: "vision" | "phash-cache"; visionCredits: number }> {
  const phash = hashScanImage(input.imageBase64)
  const cached = await getVisionCache(phash)
  if (cached?.catalog_id) {
    const bundle = await loadCardBundle(cached.catalog_id)
    if (bundle) {
      return {
        card: bundle.card,
        raw: bundle.raw,
        graded: bundle.graded,
        population: bundle.population,
        history: bundle.history,
        creditsUsed: 0,
        source: "phash-cache",
        visionCredits: 0,
      }
    }
  }

  const client = ScrydexClient.fromEnv()
  const { scrydexVisionIdentify } = await import("@/lib/scrydex/vision-identify.server")
  const response = await scrydexVisionIdentify(input.imageBase64, input.preferredGames, client.ledgerInstance)
  const partial = visionResponseToCatalog(input.preferredGames?.[0], response) as VisionCatalogPartial | null
  if (!partial?.catalog_id || !partial.game || !partial.scrydex_id) {
    throw new ScrydexVisionNoMatchError()
  }

  const visionCard = response.data?.matches?.[0]?.card
  const card = await ensureCatalogCardAfterVision(client, partial)

  try {
    await saveVisionCache({
      phash,
      catalogId: card.catalog_id,
      confidence: partial.confidence,
    })
  } catch (error) {
    console.warn("[vision] cache save failed:", error instanceof Error ? error.message : error)
  }

  let bundle =
    (await loadCardBundle(card.catalog_id)) ??
    (visionCard ? bundleFromVisionCard(partial.game, visionCard) : null)

  if (!bundle) {
    bundle = {
      card,
      raw: [],
      graded: [],
      population: [],
      history: [],
      creditsUsed: 0,
    }
  }

  const extraCredit = bundle.raw.length === 0 && bundle.graded.length === 0 ? 1 : 0

  return {
    card: bundle.card,
    raw: bundle.raw,
    graded: bundle.graded,
    population: bundle.population,
    history: bundle.history,
    creditsUsed: 0,
    source: "vision",
    visionCredits: 5 + extraCredit,
  }
}

export type { TcgGame }
