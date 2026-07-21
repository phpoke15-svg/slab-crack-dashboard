import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { hydrationJobId, writeSyncState } from "@/lib/scrydex/sync-state"
import type { TcgGame } from "@/lib/scrydex/types"

export type HydrationJob = {
  game: TcgGame
  expansionId: string
  jobId: string
  cursorPage: number
  status: string
}

type HydrationJobRow = {
  game: TcgGame
  expansion_id: string
  job_id: string
  cursor_page: number
  job_status: string
}

/** Pick the next expansion to hydrate: resume paused jobs first, then unhydrated seeded sets. */
export async function pickNextHydrationJob(game: TcgGame = "pokemon"): Promise<HydrationJob | null> {
  if (!isSupabaseConfigured()) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("get_next_hydration_job", { p_game: game })

  if (error?.code === "42883") {
    return pickNextHydrationJobFallback(game)
  }
  if (error) throw error

  const row = (data as HydrationJobRow[] | null)?.[0]
  if (!row?.expansion_id) return null

  return {
    game: row.game,
    expansionId: row.expansion_id,
    jobId: row.job_id,
    cursorPage: row.cursor_page ?? 1,
    status: row.job_status ?? "idle",
  }
}

async function pickNextHydrationJobFallback(game: TcgGame): Promise<HydrationJob | null> {
  const supabase = createAdminClient()

  const { data: activeJobs, error: activeError } = await supabase
    .from("scrydex_sync_state")
    .select("game, expansion_id, job_id, cursor_page, status")
    .like("job_id", `hydrate:${game}:%`)
    .in("status", ["paused", "running", "failed"])
    .order("updated_at", { ascending: true })
    .limit(1)

  if (activeError) throw activeError
  const active = activeJobs?.[0]
  if (active?.expansion_id) {
    return {
      game: active.game as TcgGame,
      expansionId: active.expansion_id,
      jobId: active.job_id,
      cursorPage: active.cursor_page ?? 1,
      status: active.status,
    }
  }

  const setCodes = await fetchDistinctSetCodesFallback(game)
  if (setCodes.length === 0) return null

  const { data: completeJobs, error: completeError } = await supabase
    .from("scrydex_sync_state")
    .select("expansion_id")
    .like("job_id", `hydrate:${game}:%`)
    .eq("status", "complete")

  if (completeError) throw completeError
  const complete = new Set((completeJobs ?? []).map((row) => String(row.expansion_id)))

  const nextSet = setCodes.find((setCode) => !complete.has(setCode))
  if (!nextSet) return null

  return {
    game,
    expansionId: nextSet,
    jobId: hydrationJobId(game, nextSet),
    cursorPage: 1,
    status: "idle",
  }
}

async function fetchDistinctSetCodesFallback(game: TcgGame): Promise<string[]> {
  const supabase = createAdminClient()
  const codes = new Set<string>()
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from("catalog_cards")
      .select("set_code")
      .eq("game", game)
      .order("set_code")
      .range(offset, offset + 999)

    if (error) throw error
    if (!data?.length) break

    for (const row of data) {
      if (row.set_code) codes.add(String(row.set_code))
    }

    if (data.length < 1000) break
    offset += 1000
  }

  return [...codes].sort()
}

/** Register idle hydration jobs for every seeded expansion (progress tracking). */
export async function registerSeededExpansionJobs(opts?: {
  game?: TcgGame
  limit?: number
}): Promise<number> {
  const game = opts?.game ?? "pokemon"
  if (!isSupabaseConfigured()) return 0

  const supabase = createAdminClient()
  let setCodes: string[] = []

  const { data, error } = await supabase.rpc("get_seeded_expansion_codes", { p_game: game })
  if (error?.code === "42883") {
    setCodes = await fetchDistinctSetCodesFallback(game)
  } else if (error) {
    throw error
  } else {
    setCodes = ((data ?? []) as Array<{ set_code: string }>).map((row) => row.set_code).filter(Boolean)
  }

  if (opts?.limit && opts.limit > 0) {
    setCodes = setCodes.slice(0, opts.limit)
  }

  for (const expansionId of setCodes) {
    await writeSyncState({
      jobId: hydrationJobId(game, expansionId),
      game,
      expansionId,
      status: "idle",
    })
  }

  return setCodes.length
}

export async function countHydrationProgress(game: TcgGame = "pokemon") {
  if (!isSupabaseConfigured()) {
    return { totalExpansions: 0, complete: 0, inProgress: 0, pending: 0 }
  }

  const supabase = createAdminClient()
  const setCodes = await fetchDistinctSetCodesFallback(game)
  const totalExpansions = setCodes.length

  const { data: jobs, error } = await supabase
    .from("scrydex_sync_state")
    .select("status")
    .like("job_id", `hydrate:${game}:%`)

  if (error?.code === "42P01") {
    return { totalExpansions, complete: 0, inProgress: 0, pending: totalExpansions }
  }
  if (error) throw error

  let complete = 0
  let inProgress = 0
  for (const job of jobs ?? []) {
    if (job.status === "complete") complete += 1
    else if (job.status === "paused" || job.status === "running" || job.status === "failed") {
      inProgress += 1
    }
  }

  return {
    totalExpansions,
    complete,
    inProgress,
    pending: Math.max(0, totalExpansions - complete - inProgress),
  }
}
