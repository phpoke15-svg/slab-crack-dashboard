import type { TradeFulfillment, TradeFulfillmentItem } from "@/lib/trade-binder/users"

export const FULFILLMENT_CLEAR_PATCH = {
  fulfillment_addresses_at: null,
  fulfillment_tracking_at: null,
  fulfillment_received_at: null,
} as const

export function mapFulfillmentFromRow(row: {
  fulfillment_addresses_at?: string | null
  fulfillment_tracking_at?: string | null
  fulfillment_received_at?: string | null
}): TradeFulfillment {
  return {
    addressesExchangedAt: row.fulfillment_addresses_at ?? null,
    trackingSharedAt: row.fulfillment_tracking_at ?? null,
    cardsReceivedAt: row.fulfillment_received_at ?? null,
  }
}

export function isFulfillmentItemChecked(
  fulfillment: TradeFulfillment,
  item: TradeFulfillmentItem,
): boolean {
  switch (item) {
    case "addresses_exchanged":
      return Boolean(fulfillment.addressesExchangedAt)
    case "tracking_shared":
      return Boolean(fulfillment.trackingSharedAt)
    case "cards_received":
      return Boolean(fulfillment.cardsReceivedAt)
  }
}

export const TRADE_FULFILLMENT_LABELS: Record<TradeFulfillmentItem, string> = {
  addresses_exchanged: "Addresses exchanged",
  tracking_shared: "Tracking shared",
  cards_received: "Cards received",
}
