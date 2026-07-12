import type { TraderProfile } from "@/lib/trade-binder/profile"

export type LoungeFeedMode = "all" | "following"

export type LoungeAuthor = Pick<TraderProfile, "id" | "name" | "handle" | "avatar">

export type LoungeMediaItem = {
  id: string
  kind: "image" | "video"
  url: string
  mimeType: string
}

export type LoungePost = {
  id: string
  body: string
  createdAt: string
  parentId: string | null
  author: LoungeAuthor
  media: LoungeMediaItem[]
  likeCount: number
  replyCount: number
  likedByMe: boolean
  followingAuthor: boolean
}

export type LoungeFeedResponse = {
  ok: true
  mode: LoungeFeedMode
  me: LoungeAuthor
  posts: LoungePost[]
  asOf: string
}
