"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { listFriendIds, removeFriendship, sendFriendRequest } from "@/lib/trade-binder/friends"
import { fetchProfile } from "@/lib/trade-binder/profile-db"
import { tradeNeedsMyAcceptance } from "@/lib/trade-binder/trades"
import {
  averageRating,
  type Review,
  type Trade,
  type User,
} from "@/lib/trade-binder/users"
import type { TraderProfile } from "@/lib/trade-binder/profile"
import { FriendsPanel } from "./friends-panel"
import { MessagesPanel } from "./messages-panel"
import { ProfilePanel } from "./profile-panel"
import { TradesPanel } from "./trades-panel"
import { TradeChatPanel } from "./trade-chat-panel"

type Panel =
  | { type: "friends" }
  | { type: "messages" }
  | { type: "profile"; userId: string }
  | { type: "trades" }
  | { type: "trade-chat"; otherUserId: string; tradeId?: string; prefillMyIds?: string[]; prefillTheirIds?: string[]; returnTo?: "messages" }
  | null

type SocialContextValue = {
  currentUser: User | null
  profileLoading: boolean
  friendIds: string[]
  friendCount: number
  isFriend: (id: string) => boolean
  addFriend: (id: string) => Promise<string | null>
  removeFriend: (id: string) => Promise<string | null>
  hasTradedWith: (id: string) => boolean
  reviewsFor: (id: string) => Review[]
  ratingFor: (id: string) => number
  hasReviewed: (id: string) => boolean
  addReview: (userId: string, rating: number, comment: string) => Promise<void>
  loadReviews: (userId: string) => Promise<void>
  getCachedProfile: (id: string) => User | undefined
  cacheProfile: (profile: TraderProfile) => void
  trades: Trade[]
  pendingTradeCount: number
  refreshTrades: () => Promise<void>
  refreshFriends: () => Promise<void>
  refreshProfile: () => Promise<void>
  openFriends: () => void
  openMessages: () => void
  openProfile: (id: string) => void
  openTrades: () => void
  openTradeComposer: (userId: string, prefill?: { myIds?: string[]; theirIds?: string[] }) => void
  openTradeWithUser: (userId: string, prefill?: { myIds?: string[]; theirIds?: string[] }) => void
  findTradeWithUser: (userId: string) => Trade | undefined
  openTradeChat: (otherUserId: string, options?: { tradeId?: string; returnTo?: "messages"; prefillMyIds?: string[]; prefillTheirIds?: string[] }) => void
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
  const { user, isLoading: authLoading, getSupabase } = useAuth()
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
      const res = await fetch("/api/profile", { credentials: "same-origin" })
      if (res.ok) {
        const data = (await res.json()) as { profile?: User }
        if (data.profile) {
          setCurrentUser(data.profile)
          setProfileCache((prev) => ({ ...prev, [data.profile!.id]: data.profile! }))
        }
        return
      }
      const profile = await fetchProfile(getSupabase(), user.id)
      if (profile) {
        setCurrentUser(profile)
        setProfileCache((prev) => ({ ...prev, [profile.id]: profile }))
      }
    } finally {
      setProfileLoading(false)
    }
  }, [user, getSupabase])

  const refreshFriends = useCallback(async () => {
    if (!user) {
      setFriendIds([])
      return
    }
    const res = await fetch("/api/friends", { credentials: "same-origin" })
    if (res.ok) {
      const data = (await res.json()) as { friendIds?: string[]; profiles?: User[] }
      setFriendIds(data.friendIds ?? [])
      if (data.profiles?.length) {
        setProfileCache((prev) => {
          const next = { ...prev }
          for (const p of data.profiles!) next[p.id] = p
          return next
        })
      }
      return
    }
    const ids = await listFriendIds(getSupabase(), user.id)
    setFriendIds(ids)
    const profiles = (
      await Promise.all(ids.map((id) => fetchProfile(getSupabase(), id)))
    ).filter((p): p is User => p !== null)
    if (profiles.length > 0) {
      setProfileCache((prev) => {
        const next = { ...prev }
        for (const p of profiles) next[p.id] = p
        return next
      })
    }
  }, [user, getSupabase])

  const refreshTrades = useCallback(async () => {
    if (!user) {
      setTrades([])
      setTradePartnerIds([])
      return
    }
    const res = await fetch("/api/trades", { credentials: "same-origin" })
    if (!res.ok) return
    const data = (await res.json()) as { trades: Trade[]; allTrades?: Trade[] }
    setTrades(data.trades)
    const partners = new Set<string>()
    for (const t of data.allTrades ?? data.trades) {
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
    const res = await fetch(`/api/reviews?userId=${encodeURIComponent(userId)}`, {
      credentials: "same-origin",
    })
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

  const addFriend = useCallback(
    async (id: string): Promise<string | null> => {
      if (!user) return "Sign in to add friends"
      if (id === user.id) return "You cannot add yourself"
      try {
        const { error } = await sendFriendRequest(getSupabase(), user.id, id)
        if (error) return error
        setFriendIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
        const profile = await fetchProfile(getSupabase(), id)
        if (profile) {
          setProfileCache((prev) => ({ ...prev, [id]: profile }))
        }
        return null
      } catch {
        return "Could not add friend"
      }
    },
    [user, getSupabase],
  )

  const removeFriend = useCallback(
    async (id: string): Promise<string | null> => {
      if (!user) return "Sign in required"
      try {
        const { error } = await removeFriendship(getSupabase(), user.id, id)
        if (error) return error
        setFriendIds((prev) => prev.filter((f) => f !== id))
        return null
      } catch {
        return "Could not remove friend"
      }
    },
    [user, getSupabase],
  )

  const value = useMemo<SocialContextValue>(() => {
    const reviewsFor = (id: string) => reviewsByUser[id] ?? []
    const findTradeWithUser = (otherUserId: string) =>
      trades.find(
        (t) =>
          (t.initiatorId === currentUser?.id && t.recipientId === otherUserId) ||
          (t.recipientId === currentUser?.id && t.initiatorId === otherUserId),
      )
    return {
      currentUser,
      profileLoading,
      friendIds,
      friendCount: friendIds.length,
      isFriend: (id) => friendIds.includes(id),
      addFriend,
      removeFriend,
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
          credentials: "same-origin",
        })
        if (res.ok) await loadReviews(userId)
      },
      loadReviews,
      getCachedProfile,
      cacheProfile,
      trades,
      pendingTradeCount: trades.filter(
        (t) => currentUser && tradeNeedsMyAcceptance(t, currentUser.id),
      ).length,
      refreshTrades,
      refreshFriends,
      refreshProfile,
      openFriends: () => setPanel({ type: "friends" }),
      openMessages: () => setPanel({ type: "messages" }),
      openProfile: (id) => {
        setPanel({ type: "profile", userId: id })
        void loadReviews(id)
      },
      openTrades: () => setPanel({ type: "messages" }),
      openTradeComposer: (userId, prefill) =>
        setPanel({
          type: "trade-chat",
          otherUserId: userId,
          prefillMyIds: prefill?.myIds,
          prefillTheirIds: prefill?.theirIds,
          returnTo: "messages",
        }),
      openTradeWithUser: (userId, prefill) => {
        const thread = findTradeWithUser(userId)
        setPanel({
          type: "trade-chat",
          otherUserId: userId,
          tradeId: thread?.id,
          prefillMyIds: prefill?.myIds,
          prefillTheirIds: prefill?.theirIds,
          returnTo: "messages",
        })
      },
      findTradeWithUser,
      openTradeChat: (otherUserId, options) =>
        setPanel({
          type: "trade-chat",
          otherUserId,
          tradeId: options?.tradeId,
          prefillMyIds: options?.prefillMyIds,
          prefillTheirIds: options?.prefillTheirIds,
          returnTo: options?.returnTo,
        }),
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
    addFriend,
    removeFriend,
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
      {panel?.type === "messages" && <MessagesPanel />}
      {panel?.type === "profile" && <ProfilePanel userId={panel.userId} />}
      {panel?.type === "trades" && <TradesPanel />}
      {panel?.type === "trade-chat" && (
        <TradeChatPanel
          otherUserId={panel.otherUserId}
          tradeId={panel.tradeId}
          prefillMyIds={panel.prefillMyIds}
          prefillTheirIds={panel.prefillTheirIds}
          returnTo={panel.returnTo}
        />
      )}
    </SocialContext.Provider>
  )
}
