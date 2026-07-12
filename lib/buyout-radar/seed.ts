import type { BuyoutCard, BuyoutSale } from "@/lib/buyout-radar/types"

function hoursAgo(hours: number, now = Date.now()): string {
  return new Date(now - hours * 60 * 60 * 1000).toISOString()
}

function daysAgo(days: number, hour = 12, now = Date.now()): string {
  const d = new Date(now - days * 24 * 60 * 60 * 1000)
  d.setUTCHours(hour, 0, 0, 0)
  return d.toISOString()
}

/** Catalog cards used by the buyout radar seed + detector demos. */
export const SEED_BUYOUT_CARDS: BuyoutCard[] = [
  {
    id: "sv8-161",
    name: "Umbreon ex",
    setName: "Prismatic Evolutions",
    releaseDate: "2025-01-17",
    imageUrl: "https://images.pokemontcg.io/sv8pt5/161_hires.png",
  },
  {
    id: "sv3-215",
    name: "Charizard ex",
    setName: "Obsidian Flames",
    releaseDate: "2023-08-11",
    imageUrl: "https://images.pokemontcg.io/sv3/215_hires.png",
  },
  {
    id: "sv4-253",
    name: "Mew ex",
    setName: "Paradox Rift",
    releaseDate: "2023-11-03",
    imageUrl: "https://images.pokemontcg.io/sv4/253_hires.png",
  },
  {
    id: "swsh12-TG06",
    name: "Pikachu VMAX",
    setName: "Silver Tempest Trainer Gallery",
    releaseDate: "2022-11-11",
    imageUrl: "https://images.pokemontcg.io/swsh12tg/TG06_hires.png",
  },
  {
    id: "sv6-167",
    name: "Greninja ex",
    setName: "Twilight Masquerade",
    releaseDate: "2024-05-24",
    imageUrl: "https://images.pokemontcg.io/sv6/167_hires.png",
  },
  {
    id: "sv2-215",
    name: "Miraidon ex",
    setName: "Paldea Evolved",
    releaseDate: "2023-06-09",
    imageUrl: "https://images.pokemontcg.io/sv2/215_hires.png",
  },
]

/**
 * Synthetic sales history: quiet 14-day baseline + active buyout patterns
 * on Umbreon / Charizard / Greninja so the dashboard lights up immediately.
 */
export function buildSeedBuyoutSales(now = Date.now()): BuyoutSale[] {
  const sales: BuyoutSale[] = []
  let seq = 0
  const push = (sale: Omit<BuyoutSale, "id">) => {
    seq += 1
    sales.push({ id: `seed-sale-${seq}`, ...sale })
  }

  // Quiet daily drip for every card over ~14 days (baseline).
  for (const card of SEED_BUYOUT_CARDS) {
    for (let day = 14; day >= 2; day -= 1) {
      const qty = card.id === "sv8-161" || card.id === "sv3-215" ? 2 : 1
      push({
        cardId: card.id,
        quantityPurchased: qty,
        totalPrice: qty * (18 + (day % 5)),
        buyerIpHash: `retail-${card.id.slice(0, 4)}-${day}`,
        purchasedAt: daysAgo(day, 10 + (day % 6), now),
      })
      if (day % 3 === 0) {
        push({
          cardId: card.id,
          quantityPurchased: 1,
          totalPrice: 22,
          buyerIpHash: `retail-b-${card.id.slice(-3)}-${day}`,
          purchasedAt: daysAgo(day, 18, now),
        })
      }
    }
  }

  // CRITICAL: Umbreon — ~40 copies in 24h from 2 buyer hashes (>> 5× baseline).
  for (let h = 0; h < 18; h += 1) {
    push({
      cardId: "sv8-161",
      quantityPurchased: 2,
      totalPrice: 190,
      buyerIpHash: "buyout-alpha-91f2",
      purchasedAt: hoursAgo(h * 1.1, now),
    })
  }
  for (let i = 0; i < 6; i += 1) {
    push({
      cardId: "sv8-161",
      quantityPurchased: 1,
      totalPrice: 95,
      buyerIpHash: "buyout-beta-44aa",
      purchasedAt: hoursAgo(i * 2.5 + 0.4, now),
    })
  }

  // HIGH: Charizard — concentrated 1-buyer sweep overnight.
  for (let i = 0; i < 14; i += 1) {
    push({
      cardId: "sv3-215",
      quantityPurchased: 2,
      totalPrice: 240,
      buyerIpHash: "whale-char-7c01",
      purchasedAt: hoursAgo(i * 1.4 + 0.2, now),
    })
  }

  // WARNING: Greninja — elevated volume, two hashes, milder multiple.
  for (let i = 0; i < 8; i += 1) {
    push({
      cardId: "sv6-167",
      quantityPurchased: 2,
      totalPrice: 70,
      buyerIpHash: i % 2 === 0 ? "spec-gren-a1" : "spec-gren-b2",
      purchasedAt: hoursAgo(i * 2.2, now),
    })
  }

  // Noise on Miraidon so it stays below threshold.
  for (let i = 0; i < 3; i += 1) {
    push({
      cardId: "sv2-215",
      quantityPurchased: 1,
      totalPrice: 35,
      buyerIpHash: `casual-mira-${i}`,
      purchasedAt: hoursAgo(i * 5 + 1, now),
    })
  }

  return sales
}
