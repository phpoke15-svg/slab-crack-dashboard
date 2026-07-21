import { describe, expect, it } from "vitest"
import { partitionScrydexListings, scrydexListingToRecentSale } from "@/lib/scrydex/listings"

describe("scrydex listings adapter", () => {
  it("maps listing objects to RecentSale", () => {
    const sale = scrydexListingToRecentSale({
      title: "Charizard PSA 10",
      price: 1200,
      sold_at: "2025/08/19",
      url: "https://ebay.com/item/1",
    })

    expect(sale).toEqual({
      title: "Charizard PSA 10",
      price: 1200,
      shipping: 0,
      total: 1200,
      soldDate: "2025-08-19",
      url: "https://ebay.com/item/1",
    })
  })

  it("partitions raw and PSA slab sales", () => {
    const result = partitionScrydexListings(
      [
        { title: "Raw NM", price: 50, sold_at: "2025-08-20" },
        { title: "PSA 9", price: 120, company: "PSA", grade: "9", sold_at: "2025-08-19" },
        { title: "PSA 10", price: 300, company: "PSA", grade: "10", sold_at: "2025-08-18" },
      ],
      9,
    )

    expect(result.recentRawSales).toHaveLength(1)
    expect(result.recentSlabSales).toHaveLength(1)
    expect(result.recentSlabSales[0]?.price).toBe(120)
  })
})
