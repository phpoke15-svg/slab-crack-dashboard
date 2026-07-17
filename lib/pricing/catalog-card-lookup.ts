import { getCatalogCardById, getFeaturedCatalogCards } from "@/lib/db/cards-catalog"
import { getLazyCardPrice } from "@/lib/pricing/lazy-card-price"
import { getCardPriceById } from "@/lib/pricing/db"
import { cardPriceRowToMockEntry } from "@/lib/pricing/views"
import type { MockCardEntry } from "@/lib/slab-data"

export async function lookupCatalogCardEntry(cardId: string): Promise<MockCardEntry | null> {
  const normalizedId = cardId.startsWith("poke-") ? cardId : `poke-${cardId}`
  const card = await getCatalogCardById(normalizedId)
  if (!card) return null

  const lazy = await getLazyCardPrice(card)
  const row = await getCardPriceById(card.id)

  if (row && (row.raw_price ?? 0) > 0) {
    return cardPriceRowToMockEntry(row, {
      id: card.id,
      cardName: card.name,
      setName: card.setName,
      cardNumber: card.number,
      imageUrl: card.imageUrl,
      marketInsight:
        lazy.source === "pricecharting"
          ? "Live PriceCharting prices loaded on demand."
          : "Cached market prices (refreshed on demand or by nightly sync).",
    })
  }

  return cardPriceRowToMockEntry(
    {
      card_id: card.id,
      raw_price: lazy.rawPrice,
      psa7_price: null,
      psa8_price: null,
      psa9_price: null,
      psa10_price: lazy.psa10Price,
      price_source: lazy.source === "pricecharting" ? "pricecharting" : "pricecharting",
      synced_at: lazy.syncedAt,
      sync_error: lazy.source === "unavailable" ? "unavailable" : null,
      card_name: card.name,
      card_set: card.setName,
      card_number: card.number,
    },
    {
      id: card.id,
      cardName: card.name,
      setName: card.setName,
      cardNumber: card.number,
      imageUrl: card.imageUrl,
      marketInsight:
        lazy.source === "unavailable"
          ? "No PriceCharting match found — try again later."
          : lazy.source === "skipped"
            ? "Price lookup unavailable — API key not configured."
            : "Price pending — tap again to refresh.",
    },
  )
}
