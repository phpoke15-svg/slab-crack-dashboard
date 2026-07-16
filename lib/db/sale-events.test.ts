import { describe, expect, it } from "vitest"
import { aggregateRecentSalesByDay } from "@/lib/db/sale-events"
import type { RecentSale } from "@/lib/slab-data"

describe("aggregateRecentSalesByDay", () => {
  it("groups sales by UTC day and returns median price", () => {
    const sales: RecentSale[] = [
      { title: "A", price: 10, shipping: 0, total: 10, soldDate: "2026-07-01T12:00:00Z" },
      { title: "B", price: 20, shipping: 0, total: 20, soldDate: "2026-07-01T18:00:00Z" },
      { title: "C", price: 30, shipping: 0, total: 30, soldDate: "2026-07-02" },
    ]

    expect(aggregateRecentSalesByDay(sales)).toEqual([
      { soldDate: "2026-07-01", medianPrice: 15, saleCount: 2 },
      { soldDate: "2026-07-02", medianPrice: 30, saleCount: 1 },
    ])
  })
})
