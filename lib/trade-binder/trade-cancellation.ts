import type { Trade } from "@/lib/trade-binder/users"

export const CANCEL_CLEAR_PATCH = {
  initiator_cancelled_at: null,
  recipient_cancelled_at: null,
} as const

export function mapCancellationFromRow(row: {
  initiator_cancelled_at?: string | null
  recipient_cancelled_at?: string | null
}) {
  return {
    initiatorCancelledAt: row.initiator_cancelled_at ?? null,
    recipientCancelledAt: row.recipient_cancelled_at ?? null,
  }
}

export function userHasRequestedCancel(trade: Trade, userId: string): boolean {
  if (trade.initiatorId === userId) return Boolean(trade.cancellation.initiatorCancelledAt)
  if (trade.recipientId === userId) return Boolean(trade.cancellation.recipientCancelledAt)
  return false
}

export function partnerHasRequestedCancel(trade: Trade, userId: string): boolean {
  if (trade.initiatorId === userId) return Boolean(trade.cancellation.recipientCancelledAt)
  if (trade.recipientId === userId) return Boolean(trade.cancellation.initiatorCancelledAt)
  return false
}

export function tradeNeedsMyCancelConfirmation(trade: Trade, userId: string): boolean {
  return partnerHasRequestedCancel(trade, userId) && !userHasRequestedCancel(trade, userId)
}

export function tradeAwaitingPartnerCancel(trade: Trade, userId: string): boolean {
  return userHasRequestedCancel(trade, userId) && !partnerHasRequestedCancel(trade, userId)
}
