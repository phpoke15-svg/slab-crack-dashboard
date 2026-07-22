import { describe, expect, it, vi, beforeEach } from "vitest"
import { ScrydexApiError } from "@/lib/scrydex/errors"
import { toRechartsHistoryRows } from "@/lib/scrydex/history-chart"

const loadDailyHistoryRows = vi.fn()
const getCatalogCard = vi.fn()
const persistHistoryPointsBatch = vi.fn()
const isScrydexConfigured = vi.fn()
const getAllPriceHistoryInRange = vi.fn()

vi.mock("@/lib/scrydex/db", () => ({
  getCatalogCard,
  loadDailyHistoryRows,
  persistHistoryPointsBatch,
}))

vi.mock("@/lib/scrydex/constants", () => ({
  isScrydexConfigured,
  toCatalogId: (game: string, id: string) => `${game}-${id}`,
}))

vi.mock("@/lib/scrydex/client", () => ({
  ScrydexClient: {
    fromEnv: () => ({
      getAllPriceHistoryInRange,
    }),
  },
}))

describe("loadScrydexPriceHistoryChart", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isScrydexConfigured.mockReturnValue(false)
    getCatalogCard.mockResolvedValue(null)
    persistHistoryPointsBatch.mockResolvedValue(0)
  })

  it("returns Recharts rows keyed by recorded_at with RAW and PSA grades", async () => {
    loadDailyHistoryRows.mockResolvedValue([
      {
        snapshot_date: "2026-07-01",
        price_type: "raw",
        variant: "normal",
        condition: "NM",
        market_price: 6.5,
      },
      {
        snapshot_date: "2026-07-01",
        price_type: "graded",
        variant: "normal",
        company: "PSA",
        grade: "10",
        market_price: 45,
      },
      {
        snapshot_date: "2026-07-02",
        price_type: "graded",
        variant: "normal",
        company: "PSA",
        grade: "9",
        market_price: 28,
      },
    ])

    const { loadScrydexPriceHistoryChart } = await import("@/lib/scrydex/history-loader")
    const result = await loadScrydexPriceHistoryChart({
      scrydexId: "mep-41",
      game: "pokemon",
      days: 90,
      backfill: false,
    })

    expect(result.catalogId).toBe("pokemon-mep-41")
    expect(result.rows).toEqual(
      toRechartsHistoryRows([
        { recorded_at: "2026-07-01", raw: 6.5, psa10: 45 },
        { recorded_at: "2026-07-02", psa9: 28 },
      ]),
    )
  })

  it("filters rows to raw-only when type=raw", async () => {
    loadDailyHistoryRows.mockResolvedValue([
      {
        snapshot_date: "2026-07-01",
        price_type: "raw",
        variant: "normal",
        condition: "NM",
        market_price: 6.5,
      },
      {
        snapshot_date: "2026-07-01",
        price_type: "graded",
        variant: "normal",
        company: "PSA",
        grade: "10",
        market_price: 45,
      },
    ])

    const { loadScrydexPriceHistoryChart } = await import("@/lib/scrydex/history-loader")
    const result = await loadScrydexPriceHistoryChart({
      scrydexId: "mep-41",
      game: "pokemon",
      days: 90,
      type: "raw",
      backfill: false,
    })

    expect(result.rows).toEqual([{ recorded_at: "2026-07-01", RAW: 6.5 }])
  })

  it("filters rows to graded-only when type=graded", async () => {
    loadDailyHistoryRows.mockResolvedValue([
      {
        snapshot_date: "2026-07-01",
        price_type: "raw",
        variant: "normal",
        condition: "NM",
        market_price: 6.5,
      },
      {
        snapshot_date: "2026-07-01",
        price_type: "graded",
        variant: "normal",
        company: "PSA",
        grade: "10",
        market_price: 45,
      },
      {
        snapshot_date: "2026-07-02",
        price_type: "graded",
        variant: "normal",
        company: "PSA",
        grade: "9",
        market_price: 28,
      },
    ])

    const { loadScrydexPriceHistoryChart } = await import("@/lib/scrydex/history-loader")
    const result = await loadScrydexPriceHistoryChart({
      scrydexId: "mep-41",
      game: "pokemon",
      days: 90,
      type: "graded",
      backfill: false,
    })

    expect(result.rows).toEqual([
      { recorded_at: "2026-07-01", PSA_10: 45 },
      { recorded_at: "2026-07-02", PSA_9: 28 },
    ])
  })

  it("falls back to local rows when Scrydex returns 429", async () => {
    isScrydexConfigured.mockReturnValue(true)
    getCatalogCard.mockResolvedValue({
      catalog_id: "pokemon-mep-41",
      game: "pokemon",
      scrydex_id: "mep-41",
    })
    loadDailyHistoryRows.mockResolvedValue([
      {
        snapshot_date: "2026-07-01",
        price_type: "raw",
        variant: "normal",
        condition: "NM",
        market_price: 6.5,
      },
    ])
    getAllPriceHistoryInRange.mockRejectedValue(new ScrydexApiError(429, "rate limited"))

    const { loadScrydexPriceHistoryChart } = await import("@/lib/scrydex/history-loader")
    const result = await loadScrydexPriceHistoryChart({
      scrydexId: "mep-41",
      game: "pokemon",
      days: 7,
      type: "raw",
    })

    expect(result.rateLimited).toBe(true)
    expect(result.rows).toEqual([{ recorded_at: "2026-07-01", RAW: 6.5 }])
    expect(getAllPriceHistoryInRange).toHaveBeenCalled()
  })
})
