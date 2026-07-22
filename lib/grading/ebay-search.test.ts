import { describe, expect, it } from "vitest"
import {
  slabEbayGradedAffiliateCampaign,
  slabEbayGradedSearchKeyword,
  slabEbaySearchKeyword,
} from "@/lib/grading/ebay-search"

describe("slabEbayGradedSearchKeyword", () => {
  it("searches for graded slabs without a specific grade", () => {
    expect(slabEbayGradedSearchKeyword("Charizard", "4/102", "Base Set")).toBe(
      "Charizard 4/102 Base Set PSA graded",
    )
  })
})

describe("slabEbaySearchKeyword", () => {
  it("still supports grade-specific searches elsewhere", () => {
    expect(
      slabEbaySearchKeyword("Charizard", "4/102", { company: "PSA", grade: "10" }, "Base Set"),
    ).toBe("Charizard 4/102 PSA 10")
  })
})

describe("slabEbayGradedAffiliateCampaign", () => {
  it("uses a stable graded campaign slug", () => {
    expect(slabEbayGradedAffiliateCampaign("poke-base1-4", "slabcrack")).toBe(
      "slabcrack-poke-base1-4-graded",
    )
  })
})
