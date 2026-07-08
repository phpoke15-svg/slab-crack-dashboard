"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import {
  averageRating,
  type Review,
  type Trade,
  type User,
} from "@/lib/trade-binder/users"
import type { TraderProfile } from "@/lib/trade-binder/profile"
import { FriendsPanel } from "./friends-panel"
import { ProfilePanel } from "./profile-panel"
import { TradesPanel } from "./trades-panel"

type Panel =
  | { type: "friends" }
  | { type: "profile"; userId: string }
  | { type: "trades" }
  | null

type SocialContextValue = {
  currentUser: User | null
  profileLoading: boolean
  friendIds: string[]
  friendCount: number
  isFriend: (id: string) => boolean
  addFriend: (id: string) => Promise<void>
  removeFriend: (id: string) => Promise<void>
  hasTradedWith: (id: string) => boolean
  reviewsFor: (id: string) => Review[]
  ratingFor: (id: string) => number
  hasReviewed: (id: string) => boolean
  addReview: (userId: string, rating: number, comment: string) => Promise<void>
  loadReviews: (userId: string) => Promise<void>
  getCachedProfile: (id: string) => User | undefined
  cacheProfile: (profile: TraderProfile) => void
  trades: Trade[]
  refreshTrades: () => Promise<void>
  refreshFriends: () => Promise<void>
  refreshProfile: () => Promise<void>
  openFriends: () => void
  openProfile: (id: string) => void
  openTrades: () => void
  close: () => void
}

const SocialContext = createContext<SocialContextValue | null>(null)

export function useSocial() {
  const ctx = useContext(SocialContext)
  if (!ctx) throw new Error("useSocial must be used within a SocialProvider")
  return ctx
}

export function useOptionalSocial() {
  return useContext(SocialContext)
}

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [friendIds, setFriendIds] = useState<string[]>([])
  const [tradePartnerIds, setTradePartnerIds] = useState<string[]>([])
  const [reviewsByUser, setReviewsByUser] = useState<Record<string, Review[]>>({})
  const [profileCache, setProfileCache] = useState<Record<string, User>>({})
  const [trades, setTrades] = useState<Trade[]>([])
  const [panel, setPanel] = useState<Panel>(null)

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setCurrentUser(null)
      return
    }
    setProfileLoading(true)
    try {
      const res = await fetch("/api/profile")
      if (!res.ok) return
      const data = (await res.json()) as { profile: User }
      setCurrentUser(data.profile)
      setProfileCache((prev) => ({ ...prev, [data.profile.id]: data.profile }))
    } finally {
      setProfileLoading(false)
    }
  }, [user])

  const refreshFriends = useCallback(async () => {
    if (!user) {
      setFriendIds([])
      return
    }
    const res = await fetch("/api/friends")
    if (!res.ok) return
    const data = (await res.json()) as { friendIds: string[]; profiles: User[] }
    setFriendIds(data.friendIds)
    setProfileCache((prev) => {
      const next = { ...prev }
      for (const p of data.profiles) next[p.id] = p
      return next
    })
  }, [user])

  const refreshTrades = useCallback(async () => {
    if (!user) {
      setTrades([])
      setTradePartnerIds([])
      return
    }
    const res = await fetch("/api/trades")
    if (!res.ok) return
    const data = (await res.json()) as { trades: Trade[] }
    setTrades(data.trades)
    const partners = new Set<string>()
    for (const t of data.trades) {
      if (t.status !== "completed") continue
      partners.add(t.initiatorId === user.id ? t.recipientId : t.initiatorId)
    }
    setTradePartnerIds([...partners])
  }, [user])

  useEffect(() => {
    if (authLoading) return
    void refreshProfile()
    void refreshFriends()
    void refreshTrades()
  }, [authLoading, refreshProfile, refreshFriends, refreshTrades])

  const loadReviews = useCallback(async (userId: string) => {
    const res = await fetch(`/api/reviews?userId=${encodeURIComponent(userId)}`)
    if (!res.ok) return
    const data = (await res.json()) as { reviews: Review[] }
    setReviewsByUser((prev) => ({ ...prev, [userId]: data.reviews }))
  }, [])

  const cacheProfile = useCallback((profile: TraderProfile) => {
    setProfileCache((prev) => ({ ...prev, [profile.id]: profile }))
  }, [])

  const getCachedProfile = useCallback(
    (id: string) => profileCache[id],
    [profileCache],
  )

  const value = useMemo<SocialContextValue>(() => {
    const reviewsFor = (id: string) => reviewsByUser[id] ?? []
    return {
      currentUser,
      profileLoading,
      friendIds,
      friendCount: friendIds.length,
      isFriend: (id) => friendIds.includes(id),
      addFriend: async (id) => {
        const res = await fetch("/api/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: id }),
        })
        if (res.ok) await refreshFriends()
      },
      removeFriend: async (id) => {
        const res = await fetch(`/api/friends?userId=${encodeURIComponent(id)}`, { method: "DELETE" })
        if (res.ok) await refreshFriends()
      },
      hasTradedWith: (id) => tradePartnerIds.includes(id),
      reviewsFor,
      ratingFor: (id) => averageRating(reviewsFor(id)),
      hasReviewed: (id) =>
        currentUser ? reviewsFor(id).some((r) => r.authorId === currentUser.id) : false,
      addReview: async (userId, rating, comment) => {
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revieweeId: userId, rating, comment }),
        })
        if (res.ok) await loadReviews(userId)
      },
      loadReviews,
      getCachedProfile,
      cacheProfile,
      trades,
      refreshTrades,
      refreshFriends,
      refreshProfile,
      openFriends: () => setPanel({ type: "friends" }),
      openProfile: (id) => {
        setPanel({ type: "profile", userId: id })
        void loadReviews(id)
      },
      openTrades: () => setPanel({ type: "trades" }),
      close: () => setPanel(null),
    }
  }, [
    currentUser,
    profileLoading,
    friendIds,
    tradePartnerIds,
    reviewsByUser,
    profileCache,
    trades,
    refreshFriends,
    refreshTrades,
    refreshProfile,
    loadReviews,
    getCachedProfile,
    cacheProfile,
  ])

  return (
    <SocialContext.Provider value={value}>
      {children}
      {panel?.type === "friends" && <FriendsPanel />}
      {panel?.type === "profile" && <ProfilePanel userId={panel.userId} />}
      {panel?.type === "trades" && <TradesPanel />}
    </SocialContext.Provider>
  )
}
