import { getCatalogCardById } from "@/lib/db/cards-catalog"
import { getLazyCardPrice } from "@/lib/pricing/lazy-card-price"
import { cardPriceRowToMockEntry } from "@/lib/pricing/views"
import type { LazyCardPriceResult } from "@/lib/pricing/lazy-card-price"
import type { MockCardEntry } from "@/lib/slab-data"
import type { CardPriceRow } from "@/lib/pricing/types"

function lazyToPriceRow(lazy: LazyCardPriceResult): CardPriceRow {
  const source =
    lazy.source === "tcggo"
      ? "tcggo"
      : lazy.source === "pricecharting"
        ? "pricecharting"
        : "pricecharting"
  return {
    card_id: lazy.cardId,
    raw_price: lazy.rawPrice,
    psa7_price: lazy.psa7Price,
    psa8_price: lazy.psa8Price,
    psa9_price: lazy.psa9Price,
    psa10_price: lazy.psa10Price,
    price_source: source,
    synced_at: lazy.syncedAt,
    sync_error: lazy.source === "unavailable" ? "unavailable" : null,
    card_name: null,
    card_set: null,
    card_number: null,
  }
}

export async function lookupCatalogCardEntry(cardId: string): Promise<MockCardEntry | null> {
  const normalizedId = cardId.startsWith("poke-") ? cardId : `poke-${cardId}`
  const card = await getCatalogCardById(normalizedId)
  if (!card) return null

  const lazy = await getLazyCardPrice(card)
  const row = lazyToPriceRow(lazy)

  return cardPriceRowToMockEntry(row, {
    id: card.id,
    cardName: card.name,
    setName: card.setName,
    cardNumber: card.number,
    imageUrl: card.imageUrl,
    marketInsight:
      lazy.source === "tcggo"
        ? "Live pokemon-api.com prices loaded on demand."
        : lazy.source === "pricecharting"
          ? "Live PriceCharting prices loaded on demand."
          : lazy.source === "unavailable"
            ? "No market price found — try again later."
            : lazy.source === "skipped"
              ? "Price lookup unavailable — set RAPIDAPI_POKEMON_TCG_KEY on the server."
              : (lazy.rawPrice ?? 0) > 0
                ? "Cached market prices (refreshed on demand or by nightly sync)."
                : "Price pending — tap again to refresh.",
  })
}
