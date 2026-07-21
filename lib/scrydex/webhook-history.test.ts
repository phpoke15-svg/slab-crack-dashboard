import { describe, expect, it } from "vitest"
import {
  resolveWebhookCatalogId,
  webhookPricesToDailyHistoryRows,
} from "@/lib/scrydex/webhook-history"

describe("webhook-history", () => {
  it("builds raw and PSA 10 rows for price_history_daily", () => {
    const rows = webhookPricesToDailyHistoryRows({
      catalogId: "pokemon-mep-41",
      snapshotDate: "2026-07-21",
      raw: 6.5,
      psa10: 45,
      capturedAt: "2026-07-21T12:00:00.000Z",
    })

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      catalog_id: "pokemon-mep-41",
      snapshot_date: "2026-07-21",
      price_type: "raw",
      condition: "NM",
      market_price: 6.5,
    })
    expect(rows[1]).toMatchObject({
      price_type: "graded",
      company: "PSA",
      grade: "10",
      market_price: 45,
    })
  })

  it("skips empty prices", () => {
    expect(
      webhookPricesToDailyHistoryRows({
        catalogId: "pokemon-mep-41",
        raw: 0,
        psa10: null,
      }),
    ).toEqual([])
  })

  it("resolves pokemon catalog ids from scrydex ids", () => {
    expect(resolveWebhookCatalogId("mep-41")).toBe("pokemon-mep-41")
  })
})
