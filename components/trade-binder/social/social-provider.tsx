"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import {
  CURRENT_USER_ID,
  averageRating,
  getUser,
  initialFriendIds,
  initialTradeIds,
  initialReviews,
  users,
  type Review,
  type User,
} from "@/lib/trade-binder/users"
import { FriendsPanel } from "./friends-panel"
import { ProfilePanel } from "./profile-panel"

type Panel = { type: "friends" } | { type: "profile"; userId: string } | null

type SocialContextValue = {
  currentUser: User
  users: User[]
  getUser: (id: string) => User | undefined
  friendIds: string[]
  friendCount: number
  isFriend: (id: string) => boolean
  addFriend: (id: string) => void
  removeFriend: (id: string) => void
  /** Whether the current user has completed a trade with this user. */
  hasTradedWith: (id: string) => boolean
  reviewsFor: (id: string) => Review[]
  ratingFor: (id: string) => number
  hasReviewed: (id: string) => boolean
  addReview: (userId: string, rating: number, comment: string) => void
  // navigation
  openFriends: () => void
  openProfile: (id: string) => void
  close: () => void
}

const SocialContext = createContext<SocialContextValue | null>(null)

export function useSocial() {
  const ctx = useContext(SocialContext)
  if (!ctx) throw new Error("useSocial must be used within a SocialProvider")
  return ctx
}

export function SocialProvider({ children }: { children: ReactNode }) {
  const [friendIds, setFriendIds] = useState<string[]>(initialFriendIds)
  const [tradeIds] = useState<string[]>(initialTradeIds)
  const [reviews, setReviews] = useState<Record<string, Review[]>>(initialReviews)
  const [panel, setPanel] = useState<Panel>(null)

  const currentUser = getUser(CURRENT_USER_ID)!

  const value = useMemo<SocialContextValue>(() => {
    const reviewsFor = (id: string) => reviews[id] ?? []
    return {
      currentUser,
      users,
      getUser,
      friendIds,
      friendCount: friendIds.length,
      isFriend: (id) => friendIds.includes(id),
      addFriend: (id) => setFriendIds((prev) => (prev.includes(id) ? prev : [...prev, id])),
      removeFriend: (id) => setFriendIds((prev) => prev.filter((f) => f !== id)),
      hasTradedWith: (id) => tradeIds.includes(id),
      reviewsFor,
      ratingFor: (id) => averageRating(reviewsFor(id)),
      hasReviewed: (id) => reviewsFor(id).some((r) => r.authorId === CURRENT_USER_ID),
      addReview: (userId, rating, comment) =>
        setReviews((prev) => {
          const existing = prev[userId] ?? []
          // One review per author: replace if the current user already reviewed.
          const withoutMine = existing.filter((r) => r.authorId !== CURRENT_USER_ID)
          const review: Review = {
            id: `r-${userId}-${Date.now()}`,
            authorId: CURRENT_USER_ID,
            rating,
            comment: comment.trim(),
            createdAt: new Date().toISOString().slice(0, 10),
          }
          return { ...prev, [userId]: [review, ...withoutMine] }
        }),
      openFriends: () => setPanel({ type: "friends" }),
      openProfile: (id) => setPanel({ type: "profile", userId: id }),
      close: () => setPanel(null),
    }
  }, [currentUser, friendIds, tradeIds, reviews])

  return (
    <SocialContext.Provider value={value}>
      {children}
      {panel?.type === "friends" && <FriendsPanel />}
      {panel?.type === "profile" && <ProfilePanel userId={panel.userId} />}
    </SocialContext.Provider>
  )
}
