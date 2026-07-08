import { canViewBinderByPolicy } from "@/lib/trade-binder/binder-access"
import type { TraderProfile } from "@/lib/trade-binder/profile"
import { profileRowToTrader, type ProfileRow } from "@/lib/trade-binder/profile"
import type { SupabaseClient } from "@supabase/supabase-js"

export async function loadVisibilityContext(
  supabase: SupabaseClient,
  viewerId: string,
  ownerIds: string[],
  friendIds?: string[],
): Promise<{
  friendSet: Set<string>
  profilesByUser: Map<string, TraderProfile>
}> {
  const uniqueOwners = [...new Set(ownerIds.filter((id) => id && id !== viewerId))]
  const friendSet = new Set(friendIds ?? [])

  const profilesByUser = new Map<string, TraderProfile>()
  if (uniqueOwners.length === 0) {
    return { friendSet, profilesByUser }
  }

  const { data, error } = await supabase.from("profiles").select("*").in("id", uniqueOwners)
  if (!error && data) {
    for (const row of data as ProfileRow[]) {
      profilesByUser.set(row.id, profileRowToTrader(row))
    }
  }

  return { friendSet, profilesByUser }
}

export function canViewerSeeOwnerBinder(
  viewerId: string,
  ownerId: string,
  friendSet: Set<string>,
  profilesByUser: Map<string, TraderProfile>,
): boolean {
  if (viewerId === ownerId) return true
  const profile = profilesByUser.get(ownerId)
  const isFriend = friendSet.has(ownerId)
  return canViewBinderByPolicy({
    binderVisibility: profile?.binderVisibility ?? "public",
    isSelf: false,
    isFriend,
  })
}

export function filterRowsByBinderVisibility<T extends { user_id: string }>(
  rows: T[],
  viewerId: string,
  friendSet: Set<string>,
  profilesByUser: Map<string, TraderProfile>,
): T[] {
  return rows.filter((row) =>
    canViewerSeeOwnerBinder(viewerId, row.user_id, friendSet, profilesByUser),
  )
}
