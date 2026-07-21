import {
  SCRYDEX_BASE_URL,
  SCRYDEX_CREDIT_COST,
  SCRYDEX_GAME_PATH,
  scrydexApiPath,
} from "@/lib/scrydex/constants"
import { CreditLedger } from "@/lib/scrydex/credit-ledger"
import type {
  ScrydexCardResponse,
  ScrydexHistoryResponse,
  ScrydexListResponse,
  ScrydexVisionResponse,
  TcgGame,
} from "@/lib/scrydex/types"

type RequestOptions = {
  game?: TcgGame
  catalogId?: string
  jobId?: string
}

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return ""
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

export class ScrydexClient {
  constructor(
    private apiKey = process.env.SCRYDEX_API_KEY?.trim() ?? "",
    private teamId = process.env.SCRYDEX_TEAM_ID?.trim() ?? "",
    private ledger = new CreditLedger(),
  ) {}

  static fromEnv(): ScrydexClient {
    const apiKey = process.env.SCRYDEX_API_KEY?.trim()
    const teamId = process.env.SCRYDEX_TEAM_ID?.trim()
    if (!apiKey || !teamId) {
      throw new Error("SCRYDEX_API_KEY and SCRYDEX_TEAM_ID must be configured")
    }
    return new ScrydexClient(apiKey, teamId)
  }

  async getCard(game: TcgGame, scrydexId: string, opts?: { includePrices?: boolean } & RequestOptions) {
    const path = scrydexApiPath(game, `/cards/${encodeURIComponent(scrydexId)}`)
    const query = buildQuery({
      include: opts?.includePrices ? "prices,pop_reports" : undefined,
      casing: "snake",
    })
    return this.fetch<ScrydexCardResponse>(`${path}${query}`, SCRYDEX_CREDIT_COST.catalog, opts)
  }

  async searchCards(
    game: TcgGame,
    params: { q?: string; page?: number; pageSize?: number; select?: string; orderBy?: string },
    opts?: RequestOptions,
  ) {
    const path = scrydexApiPath(game, "/cards")
    const query = buildQuery({
      q: params.q,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 100,
      select: params.select,
      orderBy: params.orderBy,
      casing: "snake",
    })
    return this.fetch<ScrydexListResponse<Record<string, unknown>>>(`${path}${query}`, SCRYDEX_CREDIT_COST.catalog, {
      ...opts,
      game,
    })
  }

  async listExpansionCards(
    game: TcgGame,
    expansionId: string,
    page = 1,
    pageSize = 100,
    opts?: RequestOptions & { includePrices?: boolean },
  ) {
    const path = scrydexApiPath(game, `/expansions/${encodeURIComponent(expansionId)}/cards`)
    const query = buildQuery({
      page,
      page_size: pageSize,
      include: opts?.includePrices ? "prices,pop_reports" : undefined,
      casing: "snake",
    })
    return this.fetch<ScrydexListResponse<Record<string, unknown>>>(`${path}${query}`, SCRYDEX_CREDIT_COST.catalog, {
      ...opts,
      game,
    })
  }

  async listExpansions(game: TcgGame, page = 1, pageSize = 100, opts?: RequestOptions) {
    const path = scrydexApiPath(game, "/expansions")
    const query = buildQuery({ page, page_size: pageSize, orderBy: "-release_date", casing: "snake" })
    return this.fetch<ScrydexListResponse<Record<string, unknown>>>(`${path}${query}`, SCRYDEX_CREDIT_COST.catalog, {
      ...opts,
      game,
    })
  }

  async getPriceHistory(
    game: TcgGame,
    scrydexId: string,
    params: { days?: number; startDate?: string; endDate?: string; company?: string; grade?: string },
    opts?: RequestOptions,
  ) {
    const path = scrydexApiPath(game, `/cards/${encodeURIComponent(scrydexId)}/price_history`)
    const query = buildQuery({
      days: params.days,
      start_date: params.startDate,
      end_date: params.endDate,
      company: params.company,
      grade: params.grade,
      casing: "snake",
    })
    return this.fetch<ScrydexHistoryResponse>(`${path}${query}`, SCRYDEX_CREDIT_COST.history, opts)
  }

  async visionIdentify(imageBase64: string, games?: TcgGame[], opts?: RequestOptions) {
    const path = "/vision/v1/identify"
    return this.fetch<ScrydexVisionResponse>(
      path,
      SCRYDEX_CREDIT_COST.vision,
      opts,
      {
        method: "POST",
        body: JSON.stringify({
          image: imageBase64,
          games: games?.map((g) => SCRYDEX_GAME_PATH[g]),
        }),
      },
    )
  }

  get ledgerInstance(): CreditLedger {
    return this.ledger
  }

  private async fetch<T>(
    path: string,
    credits: number,
    opts?: RequestOptions,
    init?: RequestInit,
  ): Promise<T> {
    await this.ledger.assertBudget(credits)

    const url = path.startsWith("http") ? path : `${SCRYDEX_BASE_URL}${path}`
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": this.apiKey,
        "X-Team-ID": this.teamId,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`Scrydex ${response.status}: ${body.slice(0, 240) || response.statusText}`)
    }

    await this.ledger.record({
      endpoint: path.split("?")[0] ?? path,
      credits,
      game: opts?.game,
      catalogId: opts?.catalogId,
      jobId: opts?.jobId,
    })

    return (await response.json()) as T
  }
}
