import "server-only"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { createUserNotification } from "@/lib/notifications/service"
import { fetchProfile } from "@/lib/trade-binder/profile-db"

async function actorLabel(actorId: string): Promise<string> {
  if (!isSupabaseConfigured()) return "Someone"
  const admin = createAdminClient()
  const profile = await fetchProfile(admin, actorId)
  return profile?.name ?? "A collector"
}

export async function notifyFriendRequest(opts: {
  addresseeId: string
  requesterId: string
  friendshipId: string
}): Promise<void> {
  const name = await actorLabel(opts.requesterId)
  await createUserNotification({
    userId: opts.addresseeId,
    type: "friend_request",
    actorId: opts.requesterId,
    entityType: "friendship",
    entityId: opts.friendshipId,
    title: "New friend request",
    body: `${name} wants to connect on PokeMatch.`,
    url: "/binder",
    dedupeKey: `friend_request:${opts.friendshipId}`,
    push: "social",
  })
}

export async function notifyPostLike(opts: {
  postAuthorId: string
  likerId: string
  postId: string
  postPreview: string
}): Promise<void> {
  const name = await actorLabel(opts.likerId)
  const preview = opts.postPreview.trim().slice(0, 80) || "your post"
  await createUserNotification({
    userId: opts.postAuthorId,
    type: "post_like",
    actorId: opts.likerId,
    entityType: "lounge_post",
    entityId: opts.postId,
    title: "New like on your post",
    body: `${name} liked “${preview}”.`,
    url: `/card-lounge?post=${opts.postId}`,
    dedupeKey: `post_like:${opts.postId}:${opts.likerId}`,
    push: "social",
  })
}

export async function notifyPostComment(opts: {
  recipientId: string
  commenterId: string
  postId: string
  rootPostId: string
  commentPreview: string
}): Promise<void> {
  const name = await actorLabel(opts.commenterId)
  const preview = opts.commentPreview.trim().slice(0, 80) || "your post"
  await createUserNotification({
    userId: opts.recipientId,
    type: "post_comment",
    actorId: opts.commenterId,
    entityType: "lounge_post",
    entityId: opts.postId,
    title: "New comment on your post",
    body: `${name} replied: “${preview}”.`,
    url: `/card-lounge?post=${opts.rootPostId}`,
    dedupeKey: `post_comment:${opts.postId}`,
    push: "social",
  })
}

export async function notifyPriceAlert(opts: {
  userId: string
  watchlistId: string
  cardName: string
  title: string
  body: string
  tool: "slabcrack" | "slablab"
  dedupeKey: string
}): Promise<void> {
  const url = opts.tool === "slablab" ? "/slablabs/slabit" : "/slablabs/slabcrack"
  await createUserNotification({
    userId: opts.userId,
    type: "price_alert",
    entityType: "watchlist_card",
    entityId: opts.watchlistId,
    title: opts.title,
    body: opts.body,
    url,
    dedupeKey: opts.dedupeKey,
    push: "price",
  })
}
