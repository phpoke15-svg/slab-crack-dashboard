import "server-only"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { ensureProfile, fetchProfile } from "@/lib/trade-binder/profile-db"
import { profileRowToTrader, type ProfileRow } from "@/lib/trade-binder/profile"
import {
  deleteLoungeStoragePaths,
  resolveLoungeMediaUrl,
  uploadLoungeMediaFiles,
  type LoungeMediaUpload,
} from "@/lib/lounge/media"
import type {
  LoungeAuthor,
  LoungeFeedMode,
  LoungeFeedResponse,
  LoungeMediaItem,
  LoungePost,
} from "@/lib/lounge/types"

const MAX_FEED = 60
const MAX_BODY = 280

type PostRow = {
  id: string
  author_id: string
  body: string
  parent_id: string | null
  created_at: string
}

type MediaRow = {
  id: string
  post_id: string
  storage_path: string
  kind: "image" | "video"
  mime_type: string
  sort_order: number
}

function toAuthor(profile: {
  id: string
  name: string
  handle: string
  avatar: string
}): LoungeAuthor {
  return {
    id: profile.id,
    name: profile.name,
    handle: profile.handle,
    avatar: profile.avatar,
  }
}

function normalizeBody(raw: string, hasMedia: boolean): string | null {
  const body = raw.replace(/\r\n/g, "\n").trim()
  if (body.length > MAX_BODY) return null
  if (!body && !hasMedia) return null
  return body
}

async function loadAuthors(
  admin: ReturnType<typeof createAdminClient>,
  authorIds: string[],
): Promise<Map<string, LoungeAuthor>> {
  const unique = [...new Set(authorIds.filter(Boolean))]
  const map = new Map<string, LoungeAuthor>()
  if (unique.length === 0) return map

  const { data } = await admin.from("profiles").select("*").in("id", unique)
  for (const row of data ?? []) {
    const trader = profileRowToTrader(row as ProfileRow)
    map.set(trader.id, toAuthor(trader))
  }
  return map
}

async function loadMediaByPost(
  admin: ReturnType<typeof createAdminClient>,
  postIds: string[],
): Promise<Map<string, LoungeMediaItem[]>> {
  const map = new Map<string, LoungeMediaItem[]>()
  if (postIds.length === 0) return map

  const { data, error } = await admin
    .from("lounge_media")
    .select("id, post_id, storage_path, kind, mime_type, sort_order")
    .in("post_id", postIds)
    .order("sort_order", { ascending: true })

  if (error) {
    // Table may not exist until lounge-media.sql is applied.
    console.warn("[lounge] media load:", error.message)
    return map
  }

  const rows = (data ?? []) as MediaRow[]
  await Promise.all(
    rows.map(async (row) => {
      const url = await resolveLoungeMediaUrl(row.storage_path)
      if (!url) return
      const item: LoungeMediaItem = {
        id: row.id,
        kind: row.kind,
        url,
        mimeType: row.mime_type,
      }
      const list = map.get(row.post_id) ?? []
      list.push(item)
      map.set(row.post_id, list)
    }),
  )
  return map
}

async function enrichPosts(
  admin: ReturnType<typeof createAdminClient>,
  rows: PostRow[],
  viewerId: string,
): Promise<LoungePost[]> {
  if (rows.length === 0) return []

  const postIds = rows.map((r) => r.id)
  const authorIds = rows.map((r) => r.author_id)
  const authors = await loadAuthors(admin, authorIds)
  const mediaByPost = await loadMediaByPost(admin, postIds)

  const [{ data: likeRows }, { data: myLikes }, { data: replyRows }, { data: followRows }] =
    await Promise.all([
      admin.from("lounge_likes").select("post_id").in("post_id", postIds),
      admin
        .from("lounge_likes")
        .select("post_id")
        .eq("user_id", viewerId)
        .in("post_id", postIds),
      admin.from("lounge_posts").select("parent_id").in("parent_id", postIds),
      admin
        .from("lounge_follows")
        .select("following_id")
        .eq("follower_id", viewerId)
        .in("following_id", authorIds),
    ])

  const likeCounts = new Map<string, number>()
  for (const row of likeRows ?? []) {
    const id = row.post_id as string
    likeCounts.set(id, (likeCounts.get(id) ?? 0) + 1)
  }

  const likedByMe = new Set((myLikes ?? []).map((r) => r.post_id as string))
  const replyCounts = new Map<string, number>()
  for (const row of replyRows ?? []) {
    const id = row.parent_id as string
    if (!id) continue
    replyCounts.set(id, (replyCounts.get(id) ?? 0) + 1)
  }
  const following = new Set((followRows ?? []).map((r) => r.following_id as string))

  const fallback: LoungeAuthor = {
    id: "unknown",
    name: "Collector",
    handle: "@collector",
    avatar: "",
  }

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    parentId: row.parent_id,
    author: authors.get(row.author_id) ?? { ...fallback, id: row.author_id },
    media: mediaByPost.get(row.id) ?? [],
    likeCount: likeCounts.get(row.id) ?? 0,
    replyCount: replyCounts.get(row.id) ?? 0,
    likedByMe: likedByMe.has(row.id),
    followingAuthor: row.author_id !== viewerId && following.has(row.author_id),
  }))
}

export async function getLoungeFeed(opts: {
  viewerId: string
  viewerEmail?: string | null
  mode?: LoungeFeedMode
  parentId?: string | null
}): Promise<LoungeFeedResponse> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured")
  }

  const admin = createAdminClient()
  const meProfile = await ensureProfile(admin, opts.viewerId, opts.viewerEmail)
  const me = toAuthor(meProfile)
  const mode: LoungeFeedMode = opts.mode === "following" ? "following" : "all"

  let query = admin
    .from("lounge_posts")
    .select("id, author_id, body, parent_id, created_at")
    .order("created_at", { ascending: false })
    .limit(MAX_FEED)

  if (opts.parentId) {
    query = query.eq("parent_id", opts.parentId)
  } else {
    query = query.is("parent_id", null)
  }

  if (mode === "following" && !opts.parentId) {
    const { data: follows } = await admin
      .from("lounge_follows")
      .select("following_id")
      .eq("follower_id", opts.viewerId)
    const ids = (follows ?? []).map((f) => f.following_id as string)
    ids.push(opts.viewerId)
    query = query.in("author_id", ids)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const posts = await enrichPosts(admin, (data ?? []) as PostRow[], opts.viewerId)

  return {
    ok: true,
    mode,
    me,
    posts,
    asOf: new Date().toISOString(),
  }
}

export async function createLoungePost(opts: {
  authorId: string
  authorEmail?: string | null
  body: string
  parentId?: string | null
  files?: File[]
}): Promise<LoungePost> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")
  const files = opts.files ?? []
  const body = normalizeBody(opts.body, files.length > 0)
  if (body === null) {
    throw new Error(
      files.length > 0
        ? `Caption must be ${MAX_BODY} characters or fewer.`
        : `Post must include text (1–${MAX_BODY} chars) or a photo/video.`,
    )
  }

  const admin = createAdminClient()
  await ensureProfile(admin, opts.authorId, opts.authorEmail)

  if (opts.parentId) {
    const { data: parent } = await admin
      .from("lounge_posts")
      .select("id")
      .eq("id", opts.parentId)
      .maybeSingle()
    if (!parent) throw new Error("Parent post not found")
  }

  let uploads: LoungeMediaUpload[] = []
  try {
    uploads = await uploadLoungeMediaFiles(opts.authorId, files)
  } catch (error) {
    throw error instanceof Error ? error : new Error("Upload failed")
  }

  const { data, error } = await admin
    .from("lounge_posts")
    .insert({
      author_id: opts.authorId,
      body,
      parent_id: opts.parentId ?? null,
    })
    .select("id, author_id, body, parent_id, created_at")
    .single()

  if (error || !data) {
    await deleteLoungeStoragePaths(uploads.map((u) => u.storagePath))
    throw new Error(error?.message || "Failed to create post")
  }

  if (uploads.length > 0) {
    const { error: mediaError } = await admin.from("lounge_media").insert(
      uploads.map((u) => ({
        post_id: data.id,
        storage_path: u.storagePath,
        kind: u.kind,
        mime_type: u.mimeType,
        sort_order: u.sortOrder,
      })),
    )
    if (mediaError) {
      await admin.from("lounge_posts").delete().eq("id", data.id)
      await deleteLoungeStoragePaths(uploads.map((u) => u.storagePath))
      throw new Error(
        mediaError.message.includes("lounge_media")
          ? "Media tables not ready — run supabase/lounge-media.sql in Supabase."
          : mediaError.message,
      )
    }
  }

  const [post] = await enrichPosts(admin, [data as PostRow], opts.authorId)
  return post!
}

export async function deleteLoungePost(opts: {
  postId: string
  viewerId: string
}): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")
  const admin = createAdminClient()
  const { data } = await admin
    .from("lounge_posts")
    .select("author_id")
    .eq("id", opts.postId)
    .maybeSingle()
  if (!data) throw new Error("Post not found")
  if (data.author_id !== opts.viewerId) throw new Error("You can only delete your own posts")

  const { data: media } = await admin
    .from("lounge_media")
    .select("storage_path")
    .eq("post_id", opts.postId)
  const paths = (media ?? []).map((m) => m.storage_path as string)

  const { error } = await admin.from("lounge_posts").delete().eq("id", opts.postId)
  if (error) throw new Error(error.message)
  await deleteLoungeStoragePaths(paths)
}

export async function toggleLoungeLike(opts: {
  postId: string
  viewerId: string
}): Promise<{ liked: boolean; likeCount: number }> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")
  const admin = createAdminClient()

  const { data: post } = await admin
    .from("lounge_posts")
    .select("id")
    .eq("id", opts.postId)
    .maybeSingle()
  if (!post) throw new Error("Post not found")

  const { data: existing } = await admin
    .from("lounge_likes")
    .select("post_id")
    .eq("post_id", opts.postId)
    .eq("user_id", opts.viewerId)
    .maybeSingle()

  if (existing) {
    await admin
      .from("lounge_likes")
      .delete()
      .eq("post_id", opts.postId)
      .eq("user_id", opts.viewerId)
  } else {
    const { error } = await admin.from("lounge_likes").insert({
      post_id: opts.postId,
      user_id: opts.viewerId,
    })
    if (error) throw new Error(error.message)
  }

  const { count } = await admin
    .from("lounge_likes")
    .select("*", { count: "exact", head: true })
    .eq("post_id", opts.postId)

  return { liked: !existing, likeCount: count ?? 0 }
}

export async function setLoungeFollow(opts: {
  viewerId: string
  targetUserId: string
  follow: boolean
}): Promise<{ following: boolean }> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured")
  if (opts.viewerId === opts.targetUserId) {
    throw new Error("You cannot follow yourself")
  }

  const admin = createAdminClient()
  const target = await fetchProfile(admin, opts.targetUserId)
  if (!target) throw new Error("User not found")

  if (opts.follow) {
    const { error } = await admin.from("lounge_follows").upsert(
      {
        follower_id: opts.viewerId,
        following_id: opts.targetUserId,
      },
      { onConflict: "follower_id,following_id" },
    )
    if (error) throw new Error(error.message)
    return { following: true }
  }

  const { error } = await admin
    .from("lounge_follows")
    .delete()
    .eq("follower_id", opts.viewerId)
    .eq("following_id", opts.targetUserId)
  if (error) throw new Error(error.message)
  return { following: false }
}
