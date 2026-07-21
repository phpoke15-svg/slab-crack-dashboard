import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { scrydexDailyCreditBudget } from "@/lib/scrydex/constants"
import type { CreditLedgerEntry, TcgGame } from "@/lib/scrydex/types"

export class ScrydexCreditBudgetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ScrydexCreditBudgetError"
  }
}

export class CreditLedger {
  private spentToday = 0

  async refreshSpentToday(): Promise<number> {
    if (!isSupabaseConfigured()) return this.spentToday

    const supabase = createAdminClient()
    const start = new Date()
    start.setUTCHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from("api_credit_ledger")
      .select("credits")
      .eq("provider", "scrydex")
      .gte("created_at", start.toISOString())

    if (error?.code === "42P01") return this.spentToday
    if (error) throw error

    this.spentToday = (data ?? []).reduce((sum, row) => sum + Number(row.credits ?? 0), 0)
    return this.spentToday
  }

  async remainingBudget(): Promise<number> {
    await this.refreshSpentToday()
    return Math.max(0, scrydexDailyCreditBudget() - this.spentToday)
  }

  async assertBudget(credits: number): Promise<void> {
    const remaining = await this.remainingBudget()
    if (credits > remaining) {
      throw new ScrydexCreditBudgetError(
        `Scrydex daily credit budget exceeded (${this.spentToday + credits}/${scrydexDailyCreditBudget()}).`,
      )
    }
  }

  async record(entry: CreditLedgerEntry): Promise<void> {
    this.spentToday += entry.credits
    if (!isSupabaseConfigured()) return

    const supabase = createAdminClient()
    const { error } = await supabase.from("api_credit_ledger").insert({
      provider: "scrydex",
      endpoint: entry.endpoint,
      credits: entry.credits,
      game: entry.game ?? null,
      catalog_id: entry.catalogId ?? null,
      job_id: entry.jobId ?? null,
    })

    if (error?.code === "42P01") return
    if (error) throw error
  }
}

export async function recordCardActivity(
  catalogId: string,
  activityType: "view" | "binder" | "portfolio" | "scan",
): Promise<void> {
  if (!isSupabaseConfigured()) return

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const { data } = await supabase
    .from("card_activity")
    .select("hit_count")
    .eq("catalog_id", catalogId)
    .eq("activity_type", activityType)
    .maybeSingle()

  const hitCount = Number(data?.hit_count ?? 0) + 1
  const { error } = await supabase.from("card_activity").upsert(
    {
      catalog_id: catalogId,
      activity_type: activityType,
      hit_count: hitCount,
      last_seen_at: now,
    },
    { onConflict: "catalog_id,activity_type" },
  )

  if (error?.code === "42P01") return
  if (error) throw error
}

export async function getCreditsUsedToday(): Promise<number> {
  const ledger = new CreditLedger()
  return ledger.refreshSpentToday()
}

export type { TcgGame }
