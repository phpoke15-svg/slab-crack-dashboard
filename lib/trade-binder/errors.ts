type PostgrestLikeError = {
  message?: string
  code?: string
  hint?: string
}

export const POKEMATCH_SETUP_HINT =
  "Run supabase/pokematch-setup.sql in your Supabase SQL Editor (safe to re-run), wait ~30 seconds, then refresh."

function isSchemaCacheError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("schema cache") ||
    lower.includes("could not find") ||
    lower.includes("does not exist")
  )
}

export function binderErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    if (isSchemaCacheError(error.message)) {
      return `Database setup is incomplete. ${POKEMATCH_SETUP_HINT}`
    }
    return error.message
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as PostgrestLikeError).message ?? "")
    const code = (error as PostgrestLikeError).code

    if (
      code === "42P01" ||
      code === "42703" ||
      code === "PGRST204" ||
      isSchemaCacheError(message) ||
      message.includes("binder_card_prices") ||
      message.includes("user_binders") ||
      message.includes("card_number") ||
      message.includes("pending_trade_id") ||
      message.includes("initiator_tracking") ||
      message.includes("recipient_tracking") ||
      message.includes("initiator_shipping_address") ||
      message.includes("recipient_shipping_address") ||
      message.includes("fulfillment_addresses_at") ||
      message.includes("fulfillment_tracking_at") ||
      message.includes("fulfillment_received_at") ||
      message.includes("initiator_cancelled_at") ||
      message.includes("recipient_cancelled_at") ||
      message.includes("initiator_accepted_at") ||
      message.includes("recipient_accepted_at") ||
      message.includes("trade_messages") ||
      message.includes("trade_chat_reads") ||
      message.includes("profiles") ||
      message.includes("friendships")
    ) {
      return `PokeMatch database setup is incomplete. ${POKEMATCH_SETUP_HINT}`
    }

    if (message) return message
  }

  return fallback
}
