import {
  catalogHitToCardSearchHit,
  type CatalogSearchHit,
} from "@/lib/db/cards-catalog"
import { catalogSearchMinLength } from "@/lib/db/catalog-search-local"
import type { CardSearchHit } from "@/lib/card-lookup"
import { catalogRowToSearchHit, searchScrydexCatalogLocal } from "@/lib/scrydex/catalog-bridge"
import { createCatalogService, isScrydexConfigured } from "@/lib/scrydex"
import type { TcgGame } from "@/lib/scrydex/types"
import { searchCatalogHybrid, type CatalogSearchSource } from "@/lib/trade-binder/catalog-search"

const GAMES = new Set<TcgGame>(["pokemon", "lorcana", "mtg"])

export function parseTcgResearchGame(value: string | null | undefined): TcgGame {
  const game = (value ?? "pokemon").trim().toLowerCase()
  return GAMES.has(game as TcgGame) ? (game as TcgGame) : "pokemon"
}

export async function searchTcgResearchCatalog(
  query: string,
  game: TcgGame,
  limit = 40,
): Promise<{ hits: CardSearchHit[]; source: CatalogSearchSource | "scrydex" }> {
  if (!catalogSearchMinLength(query)) {
    return { hits: [], source: "local" }
  }

  if (game === "pokemon") {
    const { hits, source } = await searchCatalogHybrid(query, { limit })
    return { hits: hits.map(catalogHitToCardSearchHit), source }
  }

  let hits: CatalogSearchHit[] = await searchScrydexCatalogLocal(query, limit, game)

  if (hits.length === 0 && isScrydexConfigured()) {
    try {
      const service = createCatalogService()
      const remote = await service.search({ game, q: query, pageSize: limit })
      hits = remote.cards.map((row) => catalogRowToSearchHit(row)).slice(0, limit)
      if (hits.length > 0) {
        return { hits: hits.map(catalogHitToCardSearchHit), source: "scrydex" }
      }
    } catch (error) {
      console.warn("[tcg-research/search] remote fallback failed:", error)
    }
  }

  return { hits: hits.map(catalogHitToCardSearchHit), source: "local" }
}
