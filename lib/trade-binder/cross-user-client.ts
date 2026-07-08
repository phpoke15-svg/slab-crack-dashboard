import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"

/** Service-role client for reading other users' binders after app-layer access checks. */
export function createCrossUserReader(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  return createAdminClient()
}

export function readerForBinderLoad(
  viewerId: string,
  ownerId: string,
  userClient: SupabaseClient,
): SupabaseClient {
  if (viewerId === ownerId) return userClient
  return createCrossUserReader() ?? userClient
}
