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
    id: "sv8pt5-161",
    name: "Umbreon ex",
    setName: "Prismatic Evolutions",
    releaseDate: "2025-01-17",
    imageUrl: "https://images.pokemontcg.io/sv8pt5/161_hires.png",
  },
  {
    id: "sv3-223",
    name: "Charizard ex",
    setName: "Obsidian Flames",
    releaseDate: "2023-08-11",
    imageUrl: "https://images.pokemontcg.io/sv3/223_hires.png",
  },
  {
    id: "sv3pt5-151",
    name: "Mew ex",
    setName: "151",
    releaseDate: "2023-09-22",
    imageUrl: "https://images.pokemontcg.io/sv3pt5/151_hires.png",
  },
  {
    id: "swsh4-44",
    name: "Pikachu VMAX",
    setName: "Vivid Voltage",
    releaseDate: "2020-11-13",
    imageUrl: "https://images.pokemontcg.io/swsh4/44_hires.png",
  },
  {
    id: "sv6-214",
    name: "Greninja ex",
    setName: "Twilight Masquerade",
    releaseDate: "2024-05-24",
    imageUrl: "https://images.pokemontcg.io/sv6/214_hires.png",
  },
  {
    id: "sv1-244",
    name: "Miraidon ex",
    setName: "Scarlet & Violet",
    releaseDate: "2023-03-31",
    imageUrl: "https://images.pokemontcg.io/sv1/244_hires.png",
  },
]

/**
 * Approximate NM raw market unit prices for demo seeds (mid-2026 ballpark).
 * Spike = slightly elevated paid price during the synthetic buyout window.
 */
const SEED_UNIT_PRICE: Record<string, { baseline: number; spike: number }> = {
  "sv8pt5-161": { baseline: 1485, spike: 1540 }, // Umbreon ex SIR · Prismatic Evolutions (~$1.5k raw)
  "sv3-223": { baseline: 118, spike: 135 }, // Charizard ex SIR · Obsidian Flames
  "sv3pt5-151": { baseline: 42, spike: 48 }, // Mew ex · 151
  "swsh4-44": { baseline: 24, spike: 28 }, // Pikachu VMAX · Vivid Voltage
  "sv6-214": { baseline: 345, spike: 372 }, // Greninja ex SIR · Twilight Masquerade
  "sv1-244": { baseline: 58, spike: 62 }, // Miraidon ex SIR · Scarlet & Violet
}

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
    const unit = SEED_UNIT_PRICE[card.id]?.baseline ?? 25
    for (let day = 14; day >= 2; day -= 1) {
      const qty = card.id === "sv8pt5-161" || card.id === "sv3-223" ? 2 : 1
      const jitter = ((day % 5) - 2) * 0.8
      push({
        cardId: card.id,
        quantityPurchased: qty,
        totalPrice: Math.round(qty * (unit + jitter) * 100) / 100,
        buyerIpHash: `retail-${card.id.slice(0, 4)}-${day}`,
        purchasedAt: daysAgo(day, 10 + (day % 6), now),
      })
      if (day % 3 === 0) {
        push({
          cardId: card.id,
          quantityPurchased: 1,
          totalPrice: Math.round((unit - 1.5) * 100) / 100,
          buyerIpHash: `retail-b-${card.id.slice(-3)}-${day}`,
          purchasedAt: daysAgo(day, 18, now),
        })
      }
    }
  }

  // CRITICAL: Umbreon — ~40 copies in 24h from 2 buyer hashes (>> 5× baseline).
  const umbreonSpike = SEED_UNIT_PRICE["sv8pt5-161"]!.spike
  for (let h = 0; h < 18; h += 1) {
    push({
      cardId: "sv8pt5-161",
      quantityPurchased: 2,
      totalPrice: umbreonSpike * 2,
      buyerIpHash: "buyout-alpha-91f2",
      purchasedAt: hoursAgo(h * 1.1, now),
    })
  }
  for (let i = 0; i < 6; i += 1) {
    push({
      cardId: "sv8pt5-161",
      quantityPurchased: 1,
      totalPrice: umbreonSpike,
      buyerIpHash: "buyout-beta-44aa",
      purchasedAt: hoursAgo(i * 2.5 + 0.4, now),
    })
  }

  // HIGH: Charizard — concentrated 1-buyer sweep overnight.
  const zardSpike = SEED_UNIT_PRICE["sv3-223"]!.spike
  for (let i = 0; i < 14; i += 1) {
    push({
      cardId: "sv3-223",
      quantityPurchased: 2,
      totalPrice: zardSpike * 2,
      buyerIpHash: "whale-char-7c01",
      purchasedAt: hoursAgo(i * 1.4 + 0.2, now),
    })
  }

  // WARNING: Greninja — elevated volume, two hashes, milder multiple.
  const grenSpike = SEED_UNIT_PRICE["sv6-214"]!.spike
  for (let i = 0; i < 8; i += 1) {
    push({
      cardId: "sv6-214",
      quantityPurchased: 2,
      totalPrice: grenSpike * 2,
      buyerIpHash: i % 2 === 0 ? "spec-gren-a1" : "spec-gren-b2",
      purchasedAt: hoursAgo(i * 2.2, now),
    })
  }

  // Noise on Miraidon so it stays below threshold.
  const mira = SEED_UNIT_PRICE["sv1-244"]!.baseline
  for (let i = 0; i < 3; i += 1) {
    push({
      cardId: "sv1-244",
      quantityPurchased: 1,
      totalPrice: mira,
      buyerIpHash: `casual-mira-${i}`,
      purchasedAt: hoursAgo(i * 5 + 1, now),
    })
  }

  return sales
}
