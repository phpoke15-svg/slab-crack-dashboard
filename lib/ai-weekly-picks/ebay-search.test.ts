import { describe, expect, it } from "vitest"
import {
  portfolioPickEbayAffiliateCampaign,
  portfolioPickEbaySearchKeyword,
  portfolioPickEbayUrl,
} from "@/lib/ai-weekly-picks/ebay-search"

describe("portfolio pick eBay affiliate links", () => {
  it("builds a raw NM search keyword", () => {
    expect(
      portfolioPickEbaySearchKeyword("Charizard ex", "125", "Obsidian Flames", "RAW"),
    ).toBe("Charizard ex 125 Obsidian Flames NM")
  })

  it("builds a PSA 10 search keyword", () => {
    expect(
      portfolioPickEbaySearchKeyword("Charizard", "4", "Base Set", "PSA_10"),
    ).toBe("Charizard 4 PSA 10")
  })

  it("wraps search URLs with affiliate tracking", () => {
    const url = portfolioPickEbayUrl({
      scrydex_id: "sv3-125",
      card_name: "Charizard ex",
      card_number: "125",
      set_name: "Obsidian Flames",
      grade_type: "RAW",
      bucket_tier: "250",
    })

    expect(url).toContain("ebay.com/sch/i.html")
    expect(url).toContain("campid=")
    expect(url).toContain(
      encodeURIComponent(
        portfolioPickEbayAffiliateCampaign("sv3-125", "250", "RAW"),
      ),
    )
  })
})
