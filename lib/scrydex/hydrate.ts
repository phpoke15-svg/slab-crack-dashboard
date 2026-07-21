import { parseRemoteCardList } from "@/lib/scrydex/adapters"
import { ScrydexClient } from "@/lib/scrydex/client"
import { scrydexHydrationPagesPerRun } from "@/lib/scrydex/constants"
import { persistCardPricingBundle, upsertCatalogCards, upsertExpansions } from "@/lib/scrydex/db"
import { deltaExpansionJobId, hydrationJobId, readSyncState, writeSyncState } from "@/lib/scrydex/sync-state"
import type { TcgGame } from "@/lib/scrydex/types"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type HydrateExpansionResult = {
  game: TcgGame
  expansionId: string
  pagesProcessed: number
  cardsUpserted: number
  creditsUsed: number
  nextPage: number
  complete: boolean
}

/** Paginate one expansion per cron tick — metadata only by default. */
export async function hydrateExpansionPage(input: {
  game: TcgGame
  expansionId: string
  includePrices?: boolean
  maxPages?: number
}): Promise<HydrateExpansionResult> {
  const client = ScrydexClient.fromEnv()
  const jobId = hydrationJobId(input.game, input.expansionId)
  const state = await readSyncState(jobId)
  let page = state?.cursor_page ?? 1
  const maxPages = input.maxPages ?? scrydexHydrationPagesPerRun()

  let pagesProcessed = 0
  let cardsUpserted = 0
  let creditsUsed = 0
  let totalPages = state?.total_pages ?? null
  let complete = false

  await writeSyncState({ jobId, game: input.game, expansionId: input.expansionId, status: "running" })

  try {
    while (pagesProcessed < maxPages) {
      const response = await client.listExpansionCards(input.game, input.expansionId, page, 100, {
        includePrices: input.includePrices,
        jobId,
      })
      creditsUsed += 1
      pagesProcessed += 1

      const cards = parseRemoteCardList(input.game, response.data ?? [])
      if (input.includePrices) {
        for (const raw of response.data ?? []) {
          await persistCardPricingBundle(input.game, raw)
        }
        cardsUpserted += cards.length
      } else {
        cardsUpserted += await upsertCatalogCards(cards)
      }

      totalPages =
        response.totalCount ?? response.total_count
          ? Math.ceil(Number(response.totalCount ?? response.total_count) / 100)
          : totalPages

      const pageCount = response.page ?? page
      const pageSize = response.pageSize ?? response.page_size ?? 100
      const count = response.count ?? cards.length
      if (count < pageSize) {
        complete = true
        break
      }

      if (totalPages && page >= totalPages) {
        complete = true
        break
      }

      page += 1
      await sleep(150)
    }

    await writeSyncState({
      jobId,
      game: input.game,
      expansionId: input.expansionId,
      cursorPage: complete ? 1 : page,
      totalPages,
      status: complete ? "complete" : "paused",
      creditsUsed: (state?.credits_used ?? 0) + creditsUsed,
    })

    return {
      game: input.game,
      expansionId: input.expansionId,
      pagesProcessed,
      cardsUpserted,
      creditsUsed,
      nextPage: complete ? 1 : page,
      complete,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await writeSyncState({
      jobId,
      game: input.game,
      expansionId: input.expansionId,
      cursorPage: page,
      totalPages,
      status: "failed",
      lastError: message,
    })
    throw error
  }
}

/** Discover newest expansions and seed expansion rows — 1 credit per game per run. */
export async function syncRecentExpansions(game: TcgGame, pageSize = 10) {
  const client = ScrydexClient.fromEnv()
  const response = await client.listExpansions(game, 1, pageSize, { jobId: deltaExpansionJobId(game) })
  const count = await upsertExpansions(game, response.data ?? [])
  return {
    game,
    expansions: count,
    creditsUsed: 1,
    ids: (response.data ?? []).map((row) => String((row as Record<string, unknown>).id ?? "")).filter(Boolean),
  }
}
