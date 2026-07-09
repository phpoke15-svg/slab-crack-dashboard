type PostgrestLikeError = {
  message?: string
  code?: string
  hint?: string
}

export function binderErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message

  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as PostgrestLikeError).message ?? "")
    const code = (error as PostgrestLikeError).code

    if (code === "42P01" || message.includes("user_binders")) {
      return "PokeMatch storage is not set up. Run supabase/user_binders.sql in your Supabase SQL editor, then try again."
    }

    if (
      code === "42P01" ||
      message.includes("fulfillment_addresses_at") ||
      message.includes("fulfillment_tracking_at") ||
      message.includes("fulfillment_received_at")
    ) {
      return "Trade fulfillment checklist is not set up. Run supabase/trade-fulfillment-checklist.sql in your Supabase SQL editor, then try again."
    }

    if (
      code === "42P01" ||
      message.includes("initiator_accepted_at") ||
      message.includes("recipient_accepted_at")
    ) {
      return "Dual trade acceptance is not set up. Run supabase/trade-dual-accept.sql in your Supabase SQL editor, then try again."
    }

    if (
      code === "42P01" ||
      message.includes("trade_messages") ||
      message.includes("trade_chat_reads")
    ) {
      return "Trade chat is not set up. Run supabase/setup-chat.sql in your Supabase SQL editor, then try again."
    }

    if (
      code === "42P01" ||
      message.includes("profiles") ||
      message.includes("friendships") ||
      message.includes("does not exist")
    ) {
      return "PokeMatch social features are not set up. Run supabase/pokematch.sql (or supabase/fix-binder-visibility.sql) in your Supabase SQL editor, then try again."
    }

    if (message) return message
  }

  return fallback
}
