import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { AiWeeklyPickDraft, AiWeeklyPickRow } from "@/lib/ai-weekly-picks/types"
import { BUCKET_TIERS, type BucketTier } from "@/lib/ai-weekly-picks/tiers"

export async function countWeeklyTierCoverage(weekStartDate: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ai_weekly_picks")
    .select("bucket_tier")
    .eq("week_start_date", weekStartDate)

  if (error?.code === "42P01") return 0
  if (error) throw error

  const tiers = new Set((data ?? []).map((row) => String(row.bucket_tier)))
  return tiers.size
}

export async function replaceWeeklyPicks(
  weekStartDate: string,
  picks: AiWeeklyPickDraft[],
): Promise<AiWeeklyPickRow[]> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured")
  }

  const supabase = createAdminClient()
  const { error: deleteError } = await supabase
    .from("ai_weekly_picks")
    .delete()
    .eq("week_start_date", weekStartDate)

  if (deleteError?.code === "42P01") {
    throw new Error("ai_weekly_picks table missing — run supabase/ai-weekly-picks.sql")
  }
  if (deleteError) throw deleteError

  if (picks.length === 0) return []

  const payload = picks.map((pick) => ({
    week_start_date: weekStartDate,
    bucket_tier: pick.bucket_tier,
    scrydex_id: pick.scrydex_id,
    grade_type: pick.grade_type,
    pick_price: pick.pick_price,
    projected_target_price: pick.projected_target_price,
    ai_rationale: pick.ai_rationale,
    confidence_score: pick.confidence_score,
  }))

  const { data, error } = await supabase.from("ai_weekly_picks").insert(payload).select("*")
  if (error) throw error
  return (data ?? []) as AiWeeklyPickRow[]
}

export async function loadWeeklyPicks(
  weekStartDate?: string,
  bucketTier?: BucketTier,
): Promise<AiWeeklyPickRow[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = createAdminClient()

  let targetWeek = weekStartDate
  if (!targetWeek) {
    targetWeek = (await latestWeekStartDate()) ?? undefined
  }
  if (!targetWeek) return []

  let query = supabase
    .from("ai_weekly_picks")
    .select("*")
    .eq("week_start_date", targetWeek)
    .order("confidence_score", { ascending: false })

  if (bucketTier) {
    query = query.eq("bucket_tier", bucketTier)
  }

  const { data, error } = await query
  if (error?.code === "42P01") return []
  if (error) throw error
  return (data ?? []) as AiWeeklyPickRow[]
}

export async function loadAllWeeklyPicks(limitWeeks = 26): Promise<AiWeeklyPickRow[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ai_weekly_picks")
    .select("*")
    .order("week_start_date", { ascending: false })
    .limit(limitWeeks * BUCKET_TIERS.length * 8)

  if (error?.code === "42P01") return []
  if (error) throw error
  return (data ?? []) as AiWeeklyPickRow[]
}

export async function latestWeekStartDate(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ai_weekly_picks")
    .select("week_start_date")
    .order("week_start_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error?.code === "42P01") return null
  if (error) throw error
  return data?.week_start_date ? String(data.week_start_date) : null
}
