import { describe, expect, it } from "vitest"
import { detectStealthBuyouts } from "@/lib/buyout-radar/stealth-detect"
import { buildSeedMarketSnapshots } from "@/lib/buyout-radar/seed-snapshots"
import { SEED_BUYOUT_CARDS } from "@/lib/buyout-radar/seed"

describe("detectStealthBuyouts", () => {
  it("flags seeded Charizard stealth sweep from snapshot history", () => {
    const snapshots = buildSeedMarketSnapshots()
    const cardsById = new Map(
      SEED_BUYOUT_CARDS.map((card) => [
        card.id,
        {
          name: card.name,
          setName: card.setName,
          releaseDate: card.releaseDate,
          imageUrl: card.imageUrl,
        },
      ]),
    )
    const alerts = detectStealthBuyouts(snapshots, cardsById)
    const zard = alerts.find((alert) => alert.cardId === "sv3-223")
    expect(zard).toBeDefined()
    expect(zard?.alertKind).toBe("stealth")
    expect((zard?.volumeZScore ?? 0) >= 3).toBe(true)
    expect((zard?.listingsZScore ?? 0) <= -2).toBe(true)
  })
})
