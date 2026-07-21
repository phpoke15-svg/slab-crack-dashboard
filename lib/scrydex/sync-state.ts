import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { TcgGame } from "@/lib/scrydex/types"

export type SyncStateRow = {
  job_id: string
  game: TcgGame | null
  expansion_id: string | null
  cursor_page: number
  total_pages: number | null
  status: string
  last_error: string | null
  credits_used: number
  updated_at: string
}

export async function readSyncState(jobId: string): Promise<SyncStateRow | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = createAdminClient()
  const { data, error } = await supabase.from("scrydex_sync_state").select("*").eq("job_id", jobId).maybeSingle()
  if (error?.code === "42P01") return null
  if (error) throw error
  return (data as SyncStateRow | null) ?? null
}

export async function writeSyncState(input: {
  jobId: string
  game?: TcgGame | null
  expansionId?: string | null
  cursorPage?: number
  totalPages?: number | null
  status?: string
  lastError?: string | null
  creditsUsed?: number
}): Promise<void> {
  if (!isSupabaseConfigured()) return
  const supabase = createAdminClient()
  const existing = await readSyncState(input.jobId)
  const { error } = await supabase.from("scrydex_sync_state").upsert(
    {
      job_id: input.jobId,
      game: input.game ?? existing?.game ?? null,
      expansion_id: input.expansionId ?? existing?.expansion_id ?? null,
      cursor_page: input.cursorPage ?? existing?.cursor_page ?? 1,
      total_pages: input.totalPages ?? existing?.total_pages ?? null,
      status: input.status ?? existing?.status ?? "idle",
      last_error: input.lastError ?? null,
      credits_used: input.creditsUsed ?? existing?.credits_used ?? 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "job_id" },
  )
  if (error?.code === "42P01") return
  if (error) throw error
}

export function hydrationJobId(game: TcgGame, expansionId: string) {
  return `hydrate:${game}:${expansionId}`
}

export function deltaExpansionJobId(game: TcgGame) {
  return `delta-expansions:${game}`
}
