import { describe, expect, it } from "vitest"
import {
  buildCardSlug,
  buildSetSlug,
  cardPagePath,
  formatCardNumberForSeo,
} from "@/lib/seo/card-slugs"

describe("buildSetSlug", () => {
  it("slugifies set names", () => {
    expect(buildSetSlug("base1", "Base Set")).toBe("base-set")
    expect(buildSetSlug("sv3", "Scarlet & Violet: Obsidian Flames")).toBe("obsidian-flames")
  })
})

describe("buildCardSlug", () => {
  it("combines name and number", () => {
    expect(buildCardSlug("Charizard", "4/102")).toBe("charizard-4")
  })
})

describe("formatCardNumberForSeo", () => {
  it("prefixes numbers with #", () => {
    expect(formatCardNumberForSeo("4/102")).toBe("#4/102")
  })
})

describe("cardPagePath", () => {
  it("builds pokemon card paths", () => {
    expect(cardPagePath("base-set", "charizard-4")).toBe("/pokemon/base-set/charizard-4")
  })
})
