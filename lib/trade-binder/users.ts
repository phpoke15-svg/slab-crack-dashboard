import type { TraderProfile } from "@/lib/trade-binder/profile"

export type Review = {
  id: string
  authorId: string
  rating: number
  comment: string
  createdAt: string
}

export type User = TraderProfile

export function averageRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
}

export type FriendshipStatus = "none" | "pending_outgoing" | "pending_incoming" | "accepted"

export type MatchCard = {
  cardId: string
  cardName: string
  cardSet: string
  cardImage: string
  cardNumber?: string
  rawPrice?: number
}

export type FairTradePair = {
  theyOffer: MatchCard
  youOffer: MatchCard
  valueDiffPercent: number
}

export type MatchSuggestion = {
  userId: string
  profile: TraderProfile
  theyHaveYouWant: MatchCard[]
  youHaveTheyWant: MatchCard[]
  fairPairs: FairTradePair[]
  /** False when prices could not be loaded — overlap shown without value check */
  valueVerified?: boolean
  score: number
  isFriend: boolean
}

export type TradeStatus = "pending" | "accepted" | "declined" | "completed" | "cancelled"

export type TradeItem = {
  id: string
  userId: string
  cardId: string
  cardName: string
  cardSet: string
  cardImage: string
}

export type Trade = {
  id: string
  initiatorId: string
  recipientId: string
  status: TradeStatus
  message: string
  createdAt: string
  completedAt: string | null
  items: TradeItem[]
}
