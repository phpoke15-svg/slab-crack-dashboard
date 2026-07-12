"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Heart,
  ImagePlus,
  Loader2,
  MessageCircle,
  RefreshCw,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react"
import { PlanBadge } from "@/components/plan-badge"
import { UserAvatar } from "@/components/trade-binder/social/user-avatar"
import { cn } from "@/lib/utils"
import type {
  LoungeFeedMode,
  LoungeFeedResponse,
  LoungeMediaItem,
  LoungePost,
} from "@/lib/lounge/types"

const MAX_MEDIA = 4

type LocalMedia = {
  id: string
  file: File
  previewUrl: string
  kind: "image" | "video"
}

function timeAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return ""
  const m = Math.floor(ms / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

function asUser(author: LoungePost["author"]) {
  return {
    ...author,
    location: "",
    bio: "",
    binderVisibility: "public" as const,
    plan: author.plan ?? "free",
  }
}

function MediaGrid({ items, compact }: { items: LoungeMediaItem[]; compact?: boolean }) {
  if (items.length === 0) return null
  return (
    <div
      className={cn(
        "mt-2 grid gap-1.5 overflow-hidden rounded-xl",
        items.length === 1 ? "grid-cols-1" : "grid-cols-2",
      )}
    >
      {items.map((item) =>
        item.kind === "video" ? (
          <video
            key={item.id}
            src={item.url}
            controls
            playsInline
            preload="metadata"
            className={cn(
              "w-full rounded-lg border border-border bg-black object-contain",
              compact ? "max-h-40" : "max-h-80",
            )}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            src={item.url}
            alt=""
            className={cn(
              "w-full rounded-lg border border-border object-cover",
              compact ? "max-h-40" : "max-h-80",
            )}
          />
        ),
      )}
    </div>
  )
}

export function LoungeFeed() {
  const [mode, setMode] = useState<LoungeFeedMode>("all")
  const [data, setData] = useState<LoungeFeedResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [media, setMedia] = useState<LocalMedia[]>([])
  const [posting, setPosting] = useState(false)
  const [replyTo, setReplyTo] = useState<LoungePost | null>(null)
  const [replies, setReplies] = useState<Record<string, LoungePost[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  const clearMedia = useCallback(() => {
    setMedia((prev) => {
      for (const item of prev) URL.revokeObjectURL(item.previewUrl)
      return []
    })
  }, [])

  const load = useCallback(
    async (nextMode: LoungeFeedMode = mode) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/lounge?mode=${nextMode}`, { cache: "no-store" })
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(json.error || "Could not load CardLounge")
        setData(json as LoungeFeedResponse)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load CardLounge")
      } finally {
        setLoading(false)
      }
    },
    [mode],
  )

  useEffect(() => {
    void load(mode)
  }, [load, mode])

  useEffect(() => {
    return () => {
      for (const item of media) URL.revokeObjectURL(item.previewUrl)
    }
    // only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onPickFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    const incoming = Array.from(fileList)
    setMedia((prev) => {
      const next = [...prev]
      for (const file of incoming) {
        if (next.length >= MAX_MEDIA) break
        const isVideo = file.type.startsWith("video/")
        const isImage = file.type.startsWith("image/")
        if (!isVideo && !isImage) continue
        if (isVideo && next.some((m) => m.kind === "video")) continue
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
          file,
          previewUrl: URL.createObjectURL(file),
          kind: isVideo ? "video" : "image",
        })
      }
      return next
    })
    if (fileRef.current) fileRef.current.value = ""
  }

  function removeLocalMedia(id: string) {
    setMedia((prev) => {
      const target = prev.find((m) => m.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((m) => m.id !== id)
    })
  }

  async function submitPost() {
    const body = draft.trim()
    if ((!body && media.length === 0) || posting) return
    setPosting(true)
    setError(null)
    try {
      const form = new FormData()
      form.set("body", body)
      if (replyTo?.id) form.set("parentId", replyTo.id)
      for (const item of media) form.append("files", item.file)

      const res = await fetch("/api/lounge", { method: "POST", body: form })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not post")
      setDraft("")
      clearMedia()
      if (replyTo) {
        const parentId = replyTo.id
        setReplyTo(null)
        await loadReplies(parentId)
        setData((prev) =>
          prev
            ? {
                ...prev,
                posts: prev.posts.map((p) =>
                  p.id === parentId ? { ...p, replyCount: p.replyCount + 1 } : p,
                ),
              }
            : prev,
        )
        setExpanded((s) => new Set(s).add(parentId))
      } else {
        await load(mode)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post")
    } finally {
      setPosting(false)
    }
  }

  async function loadReplies(postId: string) {
    try {
      const res = await fetch(`/api/lounge?parentId=${encodeURIComponent(postId)}`, {
        cache: "no-store",
      })
      const json = await res.json()
      if (!res.ok || !json.ok) return
      setReplies((prev) => ({ ...prev, [postId]: json.posts as LoungePost[] }))
    } catch {
      // ignore
    }
  }

  async function toggleExpand(post: LoungePost) {
    const next = new Set(expanded)
    if (next.has(post.id)) {
      next.delete(post.id)
      setExpanded(next)
      return
    }
    next.add(post.id)
    setExpanded(next)
    if (!replies[post.id]) await loadReplies(post.id)
  }

  async function toggleLike(post: LoungePost) {
    const res = await fetch(`/api/lounge/${post.id}/like`, { method: "POST" })
    const json = await res.json()
    if (!res.ok || !json.ok) return
    const patch = (p: LoungePost) =>
      p.id === post.id
        ? { ...p, likedByMe: Boolean(json.liked), likeCount: Number(json.likeCount) || 0 }
        : p
    setData((prev) => (prev ? { ...prev, posts: prev.posts.map(patch) } : prev))
    setReplies((prev) => {
      const out: Record<string, LoungePost[]> = {}
      for (const [k, list] of Object.entries(prev)) out[k] = list.map(patch)
      return out
    })
  }

  async function toggleFollow(post: LoungePost) {
    const follow = !post.followingAuthor
    const res = await fetch("/api/lounge/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: post.author.id, follow }),
    })
    const json = await res.json()
    if (!res.ok || !json.ok) return
    const authorId = post.author.id
    const following = Boolean(json.following)
    const patch = (p: LoungePost) =>
      p.author.id === authorId ? { ...p, followingAuthor: following } : p
    setData((prev) => (prev ? { ...prev, posts: prev.posts.map(patch) } : prev))
  }

  async function removePost(post: LoungePost) {
    if (!confirm("Delete this post?")) return
    const res = await fetch(`/api/lounge/${post.id}`, { method: "DELETE" })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      setError(json.error || "Could not delete")
      return
    }
    if (post.parentId) {
      await loadReplies(post.parentId)
      setData((prev) =>
        prev
          ? {
              ...prev,
              posts: prev.posts.map((p) =>
                p.id === post.parentId
                  ? { ...p, replyCount: Math.max(0, p.replyCount - 1) }
                  : p,
              ),
            }
          : prev,
      )
    } else {
      setData((prev) =>
        prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== post.id) } : prev,
      )
    }
  }

  const me = data?.me
  const remaining = 280 - draft.length
  const canPost = Boolean(draft.trim() || media.length > 0)

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "following"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              mode === m
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {m === "all" ? "CardLounge" : "Following"}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load(mode)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden />
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex gap-3">
          {me ? (
            <div className="flex flex-col items-center gap-1">
              <UserAvatar user={asUser(me)} size="sm" />
              <PlanBadge plan={me.plan ?? "free"} />
            </div>
          ) : (
            <div className="size-9 shrink-0 rounded-xl bg-muted" />
          )}
          <div className="min-w-0 flex-1">
            {replyTo ? (
              <p className="mb-2 text-[11px] text-muted-foreground">
                Replying to <span className="text-primary">{replyTo.author.handle}</span>{" "}
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={() => setReplyTo(null)}
                >
                  Cancel
                </button>
              </p>
            ) : null}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 280))}
              placeholder="What's pulling your binder focus?"
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background/80 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
            />

            {media.length > 0 ? (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {media.map((item) => (
                  <div key={item.id} className="relative overflow-hidden rounded-lg border border-border">
                    {item.kind === "video" ? (
                      <video
                        src={item.previewUrl}
                        className="h-28 w-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="h-28 w-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeLocalMedia(item.id)}
                      className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                      aria-label="Remove attachment"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => onPickFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={media.length >= MAX_MEDIA || posting}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                >
                  <ImagePlus className="size-3.5" aria-hidden />
                  Photo / video
                </button>
                <span className="text-[10px] text-muted-foreground">
                  {media.length}/{MAX_MEDIA}
                </span>
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    remaining < 20 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {remaining}
                </span>
              </div>
              <button
                type="button"
                disabled={posting || !canPost}
                onClick={() => void submitPost()}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {posting ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {replyTo ? "Reply" : "Post"}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Up to 4 photos or 1 video + photos from your phone. Images ≤8MB, videos ≤50MB.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : null}

      {!loading && data && data.posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {mode === "following"
            ? "No posts from people you follow yet. Switch to CardLounge and follow collectors."
            : "No posts yet — be the first to say something."}
        </p>
      ) : null}

      <ul className="space-y-3">
        {(data?.posts ?? []).map((post) => (
          <li key={post.id}>
            <PostCard
              post={post}
              isMine={post.author.id === me?.id}
              expanded={expanded.has(post.id)}
              replies={replies[post.id] ?? []}
              onLike={() => void toggleLike(post)}
              onFollow={() => void toggleFollow(post)}
              onReply={() => {
                setReplyTo(post)
                window.scrollTo({ top: 0, behavior: "smooth" })
              }}
              onToggleReplies={() => void toggleExpand(post)}
              onDelete={() => void removePost(post)}
              onLikeReply={(reply) => void toggleLike(reply)}
              onDeleteReply={(reply) => void removePost(reply)}
              meId={me?.id}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function PostCard({
  post,
  isMine,
  expanded,
  replies,
  onLike,
  onFollow,
  onReply,
  onToggleReplies,
  onDelete,
  onLikeReply,
  onDeleteReply,
  meId,
}: {
  post: LoungePost
  isMine: boolean
  expanded: boolean
  replies: LoungePost[]
  onLike: () => void
  onFollow: () => void
  onReply: () => void
  onToggleReplies: () => void
  onDelete: () => void
  onLikeReply: (reply: LoungePost) => void
  onDeleteReply: (reply: LoungePost) => void
  meId?: string
}) {
  return (
    <article className="rounded-2xl border border-border bg-card/60 p-4 transition hover:border-primary/30">
      <div className="flex gap-3">
        <UserAvatar user={asUser(post.author)} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="truncate text-sm font-semibold text-foreground">{post.author.name}</span>
            <span className="truncate text-[11px] text-muted-foreground">{post.author.handle}</span>
            <PlanBadge plan={post.author.plan ?? "free"} />
            <span className="text-[11px] text-muted-foreground">· {timeAgo(post.createdAt)}</span>
          </div>
          {post.body ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/95">
              {post.body}
            </p>
          ) : null}
          <MediaGrid items={post.media ?? []} />
          <div className="mt-3 flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={onLike}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition",
                post.likedByMe
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Heart className={cn("size-3.5", post.likedByMe && "fill-current")} aria-hidden />
              {post.likeCount}
            </button>
            <button
              type="button"
              onClick={onReply}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <MessageCircle className="size-3.5" aria-hidden />
              Reply
            </button>
            {post.replyCount > 0 ? (
              <button
                type="button"
                onClick={onToggleReplies}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {expanded
                  ? "Hide"
                  : `${post.replyCount} ${post.replyCount === 1 ? "reply" : "replies"}`}
              </button>
            ) : null}
            {!isMine ? (
              <button
                type="button"
                onClick={onFollow}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {post.followingAuthor ? (
                  <>
                    <UserMinus className="size-3.5" aria-hidden />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="size-3.5" aria-hidden />
                    Follow
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete
              </button>
            )}
          </div>

          {expanded ? (
            <ul className="mt-3 space-y-2 border-l border-border/80 pl-3">
              {replies.length === 0 ? (
                <li className="text-[11px] text-muted-foreground">No replies yet.</li>
              ) : (
                replies.map((reply) => (
                  <li
                    key={reply.id}
                    className="rounded-xl border border-border/60 bg-background/40 p-3"
                  >
                    <div className="flex gap-2">
                      <UserAvatar user={asUser(reply.author)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-xs font-semibold">{reply.author.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {reply.author.handle}
                          </span>
                          <PlanBadge plan={reply.author.plan ?? "free"} />
                          <span className="text-[10px] text-muted-foreground">
                            · {timeAgo(reply.createdAt)}
                          </span>
                        </div>
                        {reply.body ? (
                          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">
                            {reply.body}
                          </p>
                        ) : null}
                        <MediaGrid items={reply.media ?? []} compact />
                        <div className="mt-2 flex gap-1">
                          <button
                            type="button"
                            onClick={() => onLikeReply(reply)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]",
                              reply.likedByMe
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <Heart
                              className={cn("size-3", reply.likedByMe && "fill-current")}
                              aria-hidden
                            />
                            {reply.likeCount}
                          </button>
                          {reply.author.id === meId ? (
                            <button
                              type="button"
                              onClick={() => onDeleteReply(reply)}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-3" aria-hidden />
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      </div>
    </article>
  )
}
