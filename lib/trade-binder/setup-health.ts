import type { SupabaseClient } from "@supabase/supabase-js"

export const POKEMATCH_SETUP_SQL = "supabase/pokematch-setup.sql"

export type SetupCheck = {
  id: string
  label: string
  ok: boolean
  detail?: string
}

export type SetupHealthResult = {
  ready: boolean
  checks: SetupCheck[]
  setupSql: string
}

type Probe = {
  id: string
  label: string
  table: string
  columns?: string
}

const PROBES: Probe[] = [
  { id: "user_binders", label: "Binder storage", table: "user_binders" },
  {
    id: "user_binders_card_number",
    label: "Binder card numbers",
    table: "user_binders",
    columns: "card_number",
  },
  {
    id: "user_binders_pending",
    label: "Pending trade lock",
    table: "user_binders",
    columns: "pending_trade_id,pending_restore_status",
  },
  { id: "profiles", label: "Profiles", table: "profiles" },
  { id: "friendships", label: "Friends", table: "friendships" },
  { id: "user_blocks", label: "User blocks", table: "user_blocks" },
  { id: "user_reports", label: "User reports", table: "user_reports" },
  { id: "trades", label: "Trades", table: "trades" },
  {
    id: "trades_dual_accept",
    label: "Dual trade acceptance",
    table: "trades",
    columns: "initiator_accepted_at,recipient_accepted_at",
  },
  {
    id: "trades_dual_cancel",
    label: "Dual trade cancellation",
    table: "trades",
    columns: "initiator_cancelled_at,recipient_cancelled_at",
  },
  {
    id: "trades_shipping",
    label: "Trade shipping",
    table: "trades",
    columns: "initiator_shipping_address,recipient_shipping_address,initiator_tracking",
  },
  {
    id: "trades_fulfillment",
    label: "Fulfillment checklist",
    table: "trades",
    columns: "fulfillment_addresses_at,fulfillment_tracking_at",
  },
  { id: "trade_items", label: "Trade items", table: "trade_items" },
  { id: "trade_messages", label: "Trade chat", table: "trade_messages" },
  { id: "trade_chat_reads", label: "Chat read receipts", table: "trade_chat_reads" },
  { id: "reviews", label: "Reviews", table: "reviews" },
  { id: "binder_card_prices", label: "Price cache", table: "binder_card_prices" },
]

function isMissingSchemaError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("does not exist") ||
    lower.includes("schema cache") ||
    lower.includes("could not find") ||
    lower.includes("42p01") ||
    lower.includes("42703") ||
    lower.includes("pgrst204")
  )
}

async function probe(supabase: SupabaseClient, item: Probe): Promise<SetupCheck> {
  const select = item.columns ?? "id"
  const { error } = await supabase.from(item.table).select(select).limit(0)

  if (!error) {
    return { id: item.id, label: item.label, ok: true }
  }

  const message = error.message ?? "Unknown error"
  return {
    id: item.id,
    label: item.label,
    ok: false,
    detail: isMissingSchemaError(message)
      ? `Missing — run ${POKEMATCH_SETUP_SQL}`
      : message,
  }
}

export async function checkPokeMatchSetup(supabase: SupabaseClient): Promise<SetupHealthResult> {
  const checks: SetupCheck[] = []

  for (const item of PROBES) {
    try {
      checks.push(await probe(supabase, item))
    } catch (err) {
      checks.push({
        id: item.id,
        label: item.label,
        ok: false,
        detail: err instanceof Error ? err.message : "Check failed",
      })
    }
  }

  return {
    ready: checks.every((c) => c.ok),
    checks,
    setupSql: POKEMATCH_SETUP_SQL,
  }
}
