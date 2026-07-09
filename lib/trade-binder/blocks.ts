import type { SupabaseClient } from "@supabase/supabase-js"
import { removeFriendship } from "@/lib/trade-binder/friends"

export type ReportReason = "harassment" | "spam" | "fraud" | "inappropriate" | "other"

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment: "Harassment or bullying",
  spam: "Spam or unwanted contact",
  fraud: "Scam or fraud",
  inappropriate: "Inappropriate content",
  other: "Other",
}

export type BlockRelations = {
  blockedIds: string[]
  blockedByIds: string[]
}

export function blockExclusionSet(relations: BlockRelations): Set<string> {
  return new Set([...relations.blockedIds, ...relations.blockedByIds])
}

export async function listBlockRelations(
  supabase: SupabaseClient,
  userId: string,
): Promise<BlockRelations> {
  const [outgoing, incoming] = await Promise.all([
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId),
    supabase.from("user_blocks").select("blocker_id").eq("blocked_id", userId),
  ])

  return {
    blockedIds: (outgoing.data ?? []).map((row) => row.blocked_id as string),
    blockedByIds: (incoming.data ?? []).map((row) => row.blocker_id as string),
  }
}

export async function usersAreBlockedEitherWay(
  supabase: SupabaseClient,
  userId: string,
  otherId: string,
): Promise<boolean> {
  if (userId === otherId) return false

  const { data, error } = await supabase
    .from("user_blocks")
    .select("id")
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${userId})`,
    )
    .limit(1)

  if (error) return false
  return (data?.length ?? 0) > 0
}

export async function blockUser(
  supabase: SupabaseClient,
  blockerId: string,
  blockedId: string,
): Promise<{ error: string | null }> {
  if (blockerId === blockedId) return { error: "You cannot block yourself" }

  const { error } = await supabase.from("user_blocks").insert({
    blocker_id: blockerId,
    blocked_id: blockedId,
  })

  if (error) {
    if (error.code === "23505") return { error: null }
    return { error: error.message }
  }

  await removeFriendship(supabase, blockerId, blockedId)
  return { error: null }
}

export async function unblockUser(
  supabase: SupabaseClient,
  blockerId: string,
  blockedId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)

  return { error: error?.message ?? null }
}

export async function submitUserReport(
  supabase: SupabaseClient,
  reporterId: string,
  reportedId: string,
  reason: ReportReason,
  details: string,
): Promise<{ error: string | null }> {
  if (reporterId === reportedId) return { error: "Invalid report target" }

  const { error } = await supabase.from("user_reports").insert({
    reporter_id: reporterId,
    reported_id: reportedId,
    reason,
    details: details.trim(),
  })

  return { error: error?.message ?? null }
}
