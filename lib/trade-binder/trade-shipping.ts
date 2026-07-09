import type { Trade, TradeShipping } from "@/lib/trade-binder/users"

export const SHIPPING_CLEAR_PATCH = {
  initiator_tracking: "",
  recipient_tracking: "",
  initiator_carrier: "",
  recipient_carrier: "",
  initiator_shipping_address: "",
  recipient_shipping_address: "",
} as const

export function mapShippingFromRow(row: {
  initiator_tracking?: string | null
  recipient_tracking?: string | null
  initiator_carrier?: string | null
  recipient_carrier?: string | null
  initiator_shipping_address?: string | null
  recipient_shipping_address?: string | null
}): TradeShipping {
  return {
    initiatorTracking: row.initiator_tracking?.trim() ?? "",
    recipientTracking: row.recipient_tracking?.trim() ?? "",
    initiatorCarrier: row.initiator_carrier?.trim() ?? "",
    recipientCarrier: row.recipient_carrier?.trim() ?? "",
    initiatorAddress: row.initiator_shipping_address?.trim() ?? "",
    recipientAddress: row.recipient_shipping_address?.trim() ?? "",
  }
}

export function myOutgoingShipping(
  trade: Trade,
  userId: string,
): { tracking: string; carrier: string; address: string } {
  if (trade.initiatorId === userId) {
    return {
      tracking: trade.shipping.initiatorTracking,
      carrier: trade.shipping.initiatorCarrier,
      address: trade.shipping.initiatorAddress,
    }
  }
  return {
    tracking: trade.shipping.recipientTracking,
    carrier: trade.shipping.recipientCarrier,
    address: trade.shipping.recipientAddress,
  }
}

export function partnerOutgoingShipping(
  trade: Trade,
  userId: string,
): { tracking: string; carrier: string; address: string } {
  if (trade.initiatorId === userId) {
    return {
      tracking: trade.shipping.recipientTracking,
      carrier: trade.shipping.recipientCarrier,
      address: trade.shipping.recipientAddress,
    }
  }
  return {
    tracking: trade.shipping.initiatorTracking,
    carrier: trade.shipping.initiatorCarrier,
    address: trade.shipping.initiatorAddress,
  }
}

export const SHIPPING_CARRIERS = [
  "USPS",
  "UPS",
  "FedEx",
  "DHL",
  "Other",
] as const
