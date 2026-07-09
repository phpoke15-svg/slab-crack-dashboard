import type { Trade, TradeShipping } from "@/lib/trade-binder/users"

export function mapShippingFromRow(row: {
  initiator_tracking?: string | null
  recipient_tracking?: string | null
  initiator_carrier?: string | null
  recipient_carrier?: string | null
}): TradeShipping {
  return {
    initiatorTracking: row.initiator_tracking?.trim() ?? "",
    recipientTracking: row.recipient_tracking?.trim() ?? "",
    initiatorCarrier: row.initiator_carrier?.trim() ?? "",
    recipientCarrier: row.recipient_carrier?.trim() ?? "",
  }
}

export function myOutgoingShipping(
  trade: Trade,
  userId: string,
): { tracking: string; carrier: string } {
  if (trade.initiatorId === userId) {
    return {
      tracking: trade.shipping.initiatorTracking,
      carrier: trade.shipping.initiatorCarrier,
    }
  }
  return {
    tracking: trade.shipping.recipientTracking,
    carrier: trade.shipping.recipientCarrier,
  }
}

export function partnerOutgoingShipping(
  trade: Trade,
  userId: string,
): { tracking: string; carrier: string } {
  if (trade.initiatorId === userId) {
    return {
      tracking: trade.shipping.recipientTracking,
      carrier: trade.shipping.recipientCarrier,
    }
  }
  return {
    tracking: trade.shipping.initiatorTracking,
    carrier: trade.shipping.initiatorCarrier,
  }
}

export const SHIPPING_CARRIERS = [
  "USPS",
  "UPS",
  "FedEx",
  "DHL",
  "Other",
] as const
