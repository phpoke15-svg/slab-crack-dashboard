import { beforeEach, describe, expect, it, vi } from "vitest"
import { enrichMockEntriesWithScrydexGrades } from "@/lib/grading/enrich-scrydex-grades"
import { normalizeCardEntry } from "@/lib/slab-data"

vi.mock("@/lib/scrydex/constants", () => ({
  isScrydexConfigured: vi.fn(() => true),
}))

vi.mock("@/lib/scrydex/price-adapter", () => ({
  getScrydexCardPriceRowsForIds: vi.fn(),
}))

describe("enrichMockEntriesWithScrydexGrades", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("merges PSA 7–10 quotes from Scrydex cache rows", async () => {
    const { getScrydexCardPriceRowsForIds } = await import("@/lib/scrydex/price-adapter")
    vi.mocked(getScrydexCardPriceRowsForIds).mockResolvedValue(
      new Map([
        [
          "poke-base1-4",
          {
            card_id: "poke-base1-4",
            raw_price: 120,
            psa7_price: 150,
            psa8_price: 180,
            psa9_price: 220,
            psa10_price: 300,
            price_source: "scrydex",
            synced_at: "2026-07-01T00:00:00.000Z",
            sync_error: null,
            card_name: "Charizard",
            card_set: "Base Set",
            card_number: "4",
          },
        ],
      ]),
    )

    const entry = normalizeCardEntry({
      id: "poke-base1-4",
      pokemonTcgId: "base1-4",
      cardName: "Charizard",
      setName: "Base Set",
      cardNumber: "4",
      imageUrl: "/placeholder.svg",
      rawPrice: 120,
      slabGrade: 10,
      slabPrice: 300,
      deficit: 0,
      percentageSavings: 0,
      hasPricing: true,
      marketInsight: "test",
    })

    const [enriched] = await enrichMockEntriesWithScrydexGrades([entry])
    expect(enriched?.gradeQuotes?.map((quote) => quote.grade).sort((a, b) => a - b)).toEqual([
      7, 8, 9, 10,
    ])
    expect(enriched?.gradeQuotes?.find((quote) => quote.grade === 9)?.slabPrice).toBe(220)
  })
})
