import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"

const JOB_ID = "tcggo_catalog_arbitrage"

export type DiscoveryScanState = {
  jobId: string
  catalogPage: number
  totalPages: number | null
  updatedAt: string
}

export async function readDiscoveryCatalogPage(): Promise<number> {
  if (!isSupabaseConfigured()) {
    return Math.max(1, Number(process.env.DISCOVERY_START_PAGE ?? 1) || 1)
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("discovery_scan_state")
      .select("catalog_page")
      .eq("job_id", JOB_ID)
      .maybeSingle()

    if (error) {
      if (error.code === "42P01") {
        return Math.max(1, Number(process.env.DISCOVERY_START_PAGE ?? 1) || 1)
      }
      throw error
    }

    const page = Number(data?.catalog_page)
    return Number.isFinite(page) && page >= 1 ? page : 1
  } catch (error) {
    console.warn("[discovery] read cursor failed:", error)
    return 1
  }
}

export async function writeDiscoveryCatalogPage(page: number, totalPages?: number | null): Promise<void> {
  if (!isSupabaseConfigured()) return

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from("discovery_scan_state").upsert(
      {
        job_id: JOB_ID,
        catalog_page: Math.max(1, page),
        total_pages: totalPages ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "job_id" },
    )

    if (error && error.code !== "42P01") {
      throw error
    }
  } catch (error) {
    console.warn("[discovery] write cursor failed:", error)
  }
}
