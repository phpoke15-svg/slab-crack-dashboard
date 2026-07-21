import { createHash } from "node:crypto"
import { visionResponseToCatalog } from "@/lib/scrydex/adapters"
import { ScrydexClient } from "@/lib/scrydex/client"
import {
  getCatalogCard,
  getVisionCache,
  loadCardBundle,
  persistCardPricingBundle,
  saveVisionCache,
  upsertCatalogCards,
} from "@/lib/scrydex/db"
import type { CardPriceBundle, TcgGame } from "@/lib/scrydex/types"

export function hashScanImage(imageBase64: string): string {
  return createHash("sha256").update(imageBase64).digest("hex").slice(0, 40)
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
  const response = await client.visionIdentify(input.imageBase64, input.preferredGames)
  const partial = visionResponseToCatalog(input.preferredGames?.[0], response)
  if (!partial?.catalog_id || !partial.game || !partial.scrydex_id) {
    throw new Error("Scrydex Vision returned no match")
  }

  let card = await getCatalogCard(partial.catalog_id)
  if (!card) {
    // Prefer full card fetch with prices when vision payload is thin — +1 credit
    try {
      const remote = await client.getCard(partial.game, partial.scrydex_id, {
        includePrices: true,
        catalogId: partial.catalog_id,
      })
      if (remote.data) {
        card = await persistCardPricingBundle(partial.game, remote.data)
      } else {
        await upsertCatalogCards([
          {
            catalog_id: partial.catalog_id,
            game: partial.game,
            scrydex_id: partial.scrydex_id,
            name: partial.name ?? "Unknown card",
            set_code: partial.set_code ?? "unknown",
            set_name: partial.set_name ?? "Unknown set",
            number: partial.number ?? "",
            image_small_url: partial.image_small_url ?? null,
            image_large_url: partial.image_large_url ?? null,
            subtypes: [],
            variants: [],
            metadata: partial.metadata ?? {},
          },
        ])
        card = (await getCatalogCard(partial.catalog_id))!
      }
    } catch {
      await upsertCatalogCards([
        {
          catalog_id: partial.catalog_id,
          game: partial.game,
          scrydex_id: partial.scrydex_id,
          name: partial.name ?? "Unknown card",
          set_code: partial.set_code ?? "unknown",
          set_name: partial.set_name ?? "Unknown set",
          number: partial.number ?? "",
          image_small_url: partial.image_small_url ?? null,
          image_large_url: partial.image_large_url ?? null,
          subtypes: [],
          variants: [],
          metadata: partial.metadata ?? {},
        },
      ])
      card = (await getCatalogCard(partial.catalog_id))!
    }
  }

  await saveVisionCache({
    phash,
    catalogId: card.catalog_id,
    confidence: partial.confidence,
  })

  const bundle = await loadCardBundle(card.catalog_id)
  if (!bundle) throw new Error("Failed to load card bundle after vision match")

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
