import { describe, expect, it } from "vitest"
import {
  scrydexBundleToCardPriceRow,
  getScrydexRawPricesForIds,
} from "@/lib/scrydex/price-adapter"
import {
  catalogRowToSearchHit,
} from "@/lib/scrydex/catalog-bridge"
import {
  catalogHitIdForUi,
  legacyPokeIdToCatalogId,
  resolveCatalogId,
} from "@/lib/scrydex/constants"
import { cardIdVariants } from "@/lib/trade-binder/card-id-match"

describe("resolveCatalogId", () => {
  it("maps legacy poke ids to pokemon catalog ids", () => {
    expect(resolveCatalogId("poke-sv3pt5-173")).toBe("pokemon-sv3pt5-173")
    expect(resolveCatalogId("sv3pt5-173")).toBe("pokemon-sv3pt5-173")
    expect(resolveCatalogId("pokemon-sv3pt5-173")).toBe("pokemon-sv3pt5-173")
    expect(resolveCatalogId("pc-12345")).toBeNull()
  })
})

describe("cardIdVariants", () => {
  it("includes pokemon and poke aliases", () => {
    expect(cardIdVariants("poke-sv3pt5-173")).toEqual(
      expect.arrayContaining(["poke-sv3pt5-173", "sv3pt5-173", "pokemon-sv3pt5-173"]),
    )
    expect(cardIdVariants("pokemon-sv3pt5-173")).toEqual(
      expect.arrayContaining(["pokemon-sv3pt5-173", "poke-sv3pt5-173", "sv3pt5-173"]),
    )
  })
})

describe("scrydexBundleToCardPriceRow", () => {
  it("maps raw and PSA graded prices to CardPriceRow", () => {
    const row = scrydexBundleToCardPriceRow({
      card: {
        catalog_id: "pokemon-sv3pt5-173",
        name: "Charizard ex",
        set_name: "151",
        number: "173",
      },
      raw: [{ catalog_id: "pokemon-sv3pt5-173", variant: "normal", condition: "NM", market_price: 12.5 }],
      graded: [
        { catalog_id: "pokemon-sv3pt5-173", company: "PSA", grade: "10", market_price: 250 },
        { catalog_id: "pokemon-sv3pt5-173", company: "PSA", grade: "9", market_price: 120 },
      ],
      legacyCardId: "poke-sv3pt5-173",
    })

    expect(row?.card_id).toBe("poke-sv3pt5-173")
    expect(row?.raw_price).toBe(12.5)
    expect(row?.psa10_price).toBe(250)
    expect(row?.psa9_price).toBe(120)
    expect(row?.price_source).toBe("scrydex")
  })

  it("returns null when no prices exist", () => {
    expect(
      scrydexBundleToCardPriceRow({
        card: { catalog_id: "pokemon-sv3pt5-173", name: "Charizard ex", set_name: "151", number: "173" },
        raw: [],
        graded: [],
      }),
    ).toBeNull()
  })
})

describe("catalogRowToSearchHit", () => {
  it("uses poke id in UI", () => {
    const hit = catalogRowToSearchHit(
      {
        catalog_id: "pokemon-sv3pt5-173",
        game: "pokemon",
        scrydex_id: "sv3pt5-173",
        name: "Charizard ex",
        set_code: "sv3pt5",
        set_name: "151",
        number: "173",
      },
      { rawPrice: 12.5 },
    )

    expect(hit.id).toBe("poke-sv3pt5-173")
    expect(hit.rawPrice).toBe(12.5)
    expect(catalogHitIdForUi("pokemon-sv3pt5-173")).toBe("poke-sv3pt5-173")
    expect(legacyPokeIdToCatalogId(hit.id)).toBe("pokemon-sv3pt5-173")
  })
})

describe("getScrydexRawPricesForIds", () => {
  it("returns empty map without Supabase", async () => {
    const prices = await getScrydexRawPricesForIds(["poke-sv3pt5-173"])
    expect(prices.size).toBe(0)
  })
})
