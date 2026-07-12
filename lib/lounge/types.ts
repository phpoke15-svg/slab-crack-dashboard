import type { TraderProfile } from "@/lib/trade-binder/profile"
import type { PlanId } from "@/lib/billing/plans"

export type LoungeFeedMode = "all" | "following"

export type LoungeAuthor = Pick<TraderProfile, "id" | "name" | "handle" | "avatar"> & {
  /** Account tier for CardLounge badges (free displays as Starter). */
  plan: PlanId
}

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
