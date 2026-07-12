import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"

/** Minimum gap between last_seen_at writes per user. */
const TOUCH_THROTTLE_MS = 5 * 60 * 1000

/**
 * Record that a signed-in user was active on the site.
 * Throttled to avoid a write on every request. No-op if Supabase
 * is missing or the last_seen_at column is not migrated yet.
 */
export async function touchLastSeen(userId: string): Promise<void> {
  if (!userId || !isSupabaseConfigured()) return

  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from("profiles")
      .select("last_seen_at")
      .eq("id", userId)
      .maybeSingle()

    const lastMs = data?.last_seen_at ? new Date(String(data.last_seen_at)).getTime() : 0
    if (Number.isFinite(lastMs) && Date.now() - lastMs < TOUCH_THROTTLE_MS) return

    const now = new Date().toISOString()
    const { error } = await admin.from("profiles").update({ last_seen_at: now }).eq("id", userId)
    if (error) {
      // Column may not exist until profile-last-seen.sql is applied.
      return
    }
  } catch {
    // Never fail the calling request because of presence tracking.
  }
}
