import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { sendWebPushToUser } from "@/lib/push/web-push"
import type { NotificationType, UserNotification } from "@/lib/notifications/types"

type CreateNotificationInput = {
  userId: string
  type: NotificationType
  actorId?: string | null
  entityType?: string | null
  entityId?: string | null
  title: string
  body: string
  url: string
  dedupeKey?: string
  push?: "social" | "price"
}

type NotificationRow = {
  id: string
  user_id: string
  type: NotificationType
  actor_id: string | null
  entity_type: string | null
  entity_id: string | null
  title: string
  body: string
  url: string
  read_at: string | null
  created_at: string
}

function rowToNotification(row: NotificationRow): UserNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    actorId: row.actor_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    title: row.title,
    body: row.body,
    url: row.url,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

export async function createUserNotification(
  input: CreateNotificationInput,
): Promise<UserNotification | null> {
  if (!isSupabaseConfigured()) return null
  if (input.actorId && input.actorId === input.userId) return null

  const admin = createAdminClient()
  const row = {
    user_id: input.userId,
    type: input.type,
    actor_id: input.actorId ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    title: input.title,
    body: input.body,
    url: input.url,
    dedupe_key: input.dedupeKey ?? null,
  }

  const { data, error } = await admin
    .from("user_notifications")
    .upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("*")
    .maybeSingle()

  if (error) {
    if (error.message.includes("user_notifications")) return null
    if (error.code === "23505") return null
    throw new Error(`Failed to create notification: ${error.message}`)
  }

  if (!data) return null

  const notification = rowToNotification(data as NotificationRow)

  if (input.push) {
    await sendWebPushToUser(input.userId, input.push, {
      title: input.title,
      body: input.body,
      url: input.url,
      tag: input.dedupeKey ?? `notify-${notification.id}`,
    }).catch(() => null)
  }

  return notification
}

export async function listNotificationsForUser(
  supabase: SupabaseClient,
  userId: string,
  limit = 40,
): Promise<{ notifications: UserNotification[] }> {
  if (!isSupabaseConfigured()) {
    return { notifications: [] }
  }

  const { data, error } = await supabase
    .from("user_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (error.message.includes("user_notifications")) {
      return { notifications: [] }
    }
    throw new Error(error.message)
  }

  const rows = (data ?? []) as NotificationRow[]
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[]
  const actorMap = new Map<string, { name: string; handle: string }>()

  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, handle")
      .in("id", actorIds)
    for (const profile of profiles ?? []) {
      actorMap.set(profile.id as string, {
        name: (profile.display_name as string) || "Collector",
        handle: profile.handle ? `@${profile.handle}` : "@collector",
      })
    }
  }

  const notifications = rows.map((row) => {
    const base = rowToNotification(row)
    const actor = row.actor_id ? actorMap.get(row.actor_id) : null
    return {
      ...base,
      actorName: actor?.name ?? null,
      actorHandle: actor?.handle ?? null,
    }
  })

  return { notifications }
}

export async function markNotificationsRead(
  supabase: SupabaseClient,
  userId: string,
  ids?: string[],
): Promise<void> {
  if (!isSupabaseConfigured()) return

  const now = new Date().toISOString()
  let query = supabase
    .from("user_notifications")
    .update({ read_at: now })
    .eq("user_id", userId)
    .is("read_at", null)

  if (ids?.length) {
    query = query.in("id", ids)
  }

  const { error } = await query
  if (error && !error.message.includes("user_notifications")) {
    throw new Error(error.message)
  }
}

export async function countUnreadNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  if (!isSupabaseConfigured()) return 0

  const { count, error } = await supabase
    .from("user_notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null)

  if (error) {
    if (error.message.includes("user_notifications")) return 0
    return 0
  }
  return count ?? 0
}
