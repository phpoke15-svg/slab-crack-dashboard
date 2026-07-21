import { describe, expect, it } from "vitest"
import {
  tcgGoCardToPokemonCard,
  tcgGoFetchedPricesToCardPricingUsd,
  tcgGoHistoryPointToUsd,
} from "@/lib/types/pokemon-api-adapters"
import type { TcgGoCard } from "@/lib/tcggo-api"

describe("pokemon-api adapters", () => {
  it("maps tcggo card payload to PokemonCard", () => {
    const card: TcgGoCard = {
      id: 42,
      name: "Chimchar",
      tcgid: "mep-41",
      tcgplayer_id: 999,
      card_number: 41,
      rarity: "Common",
      image: "https://images.example/chimchar.jpg",
      episode: { name: "MEP Black Star Promos", code: "mep" },
      prices: {
        tcg_player: { market_price: 7.5, low_price: 6.0, mid_price: 19.97 },
        ebay: { graded: { psa: { "8": { median_price: 223 } } } },
      },
    }

    const mapped = tcgGoCardToPokemonCard(card)
    expect(mapped.id).toBe("poke-mep-41")
    expect(mapped.tcgId).toBe("mep-41")
    expect(mapped.language).toBe("en")
    expect(mapped.images.front).toContain("chimchar")
  })

  it("maps fetched prices to USD pricing shape", () => {
    const pricing = tcgGoFetchedPricesToCardPricingUsd({
      rawPrice: 7.5,
      psa7Price: 0,
      psa8Price: 223,
      psa9Price: 412,
      psa10Price: 900,
    })
    expect(pricing.currency).toBe("USD")
    expect(pricing.usdMarket).toBe(7.5)
    expect(pricing.psa8Usd).toBe(223)
  })

  it("maps history points with grade-based source", () => {
    expect(tcgGoHistoryPointToUsd({ date: "2026-07-01", grade: 0, price: 7.5 }).source).toBe("tcgplayer")
    expect(tcgGoHistoryPointToUsd({ date: "2026-07-01", grade: 8, price: 223 }).source).toBe("ebay")
  })
})
