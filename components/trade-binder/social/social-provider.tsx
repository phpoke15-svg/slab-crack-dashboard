"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { fetchProfile } from "@/lib/trade-binder/profile-db"
import type { ReportReason } from "@/lib/trade-binder/blocks"
import { isTradeAcceptedForDisplay, tradeNeedsMyAcceptance } from "@/lib/trade-binder/trades"
import {
  averageRating,
  type FriendshipStatus,
  type Review,
  type Trade,
  type User,
} from "@/lib/trade-binder/users"
import type { TraderProfile } from "@/lib/trade-binder/profile"
import { AcceptedTradesPanel } from "./accepted-trades-panel"
import { FriendsPanel } from "./friends-panel"
import { MessagesPanel } from "./messages-panel"
import { ProfilePanel } from "./profile-panel"
import { TradeChatPanel } from "./trade-chat-panel"
import { TradeComposerPanel } from "./trade-composer-panel"

type Panel =
  | { type: "friends" }
  | { type: "messages" }
  | { type: "profile"; userId: string }
  | { type: "accepted-trades" }
  | { type: "trade-composer"; userId: string; prefillMyIds?: string[]; prefillTheirIds?: string[] }
  | { type: "trade-chat"; otherUserId: string; tradeId?: string; prefillMyIds?: string[]; prefillTheirIds?: string[]; returnTo?: "messages" | "accepted-trades" }
  | null

type SocialContextValue = {
  currentUser: User | null
  profileLoading: boolean
  friendIds: string[]
  friendCount: number
  incomingRequestIds: string[]
  outgoingRequestIds: string[]
  pendingFriendRequestCount: number
  friendshipStatus: (id: string) => FriendshipStatus
  isFriend: (id: string) => boolean
  addFriend: (id: string) => Promise<string | null>
  acceptFriendRequest: (id: string) => Promise<string | null>
  declineFriendRequest: (id: string) => Promise<string | null>
  removeFriend: (id: string) => Promise<string | null>
  blockedIds: string[]
  blockedByIds: string[]
  isBlocked: (id: string) => boolean
  isBlockedBy: (id: string) => boolean
  cannotInteract: (id: string) => boolean
  blockUser: (id: string) => Promise<string | null>
  unblockUser: (id: string) => Promise<string | null>
  reportUser: (id: string, reason: ReportReason, details: string) => Promise<string | null>
  refreshBlocks: () => Promise<void>
  hasTradedWith: (id: string) => boolean
  reviewsFor: (id: string) => Review[]
  ratingFor: (id: string) => number
  hasReviewed: (id: string) => boolean
  addReview: (userId: string, rating: number, comment: string) => Promise<string | null>
  loadReviews: (userId: string) => Promise<void>
  getCachedProfile: (id: string) => User | undefined
  cacheProfile: (profile: TraderProfile) => void
  trades: Trade[]
  allTrades: Trade[]
  pendingTradeCount: number
  acceptedTradeCount: number
  refreshTrades: () => Promise<void>
  refreshFriends: () => Promise<void>
  refreshProfile: () => Promise<void>
  openFriends: () => void
  openMessages: () => void
  openAcceptedTrades: () => void
  openProfile: (id: string) => void
  openTradeComposer: (userId: string, prefill?: { myIds?: string[]; theirIds?: string[] }) => void
  openTradeWithUser: (userId: string, prefill?: { myIds?: string[]; theirIds?: string[] }) => void
  findTradeWithUser: (userId: string) => Trade | undefined
  openTradeChat: (otherUserId: string, options?: { tradeId?: string; returnTo?: "messages" | "accepted-trades"; prefillMyIds?: string[]; prefillTheirIds?: string[] }) => void
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
  const [incomingRequestIds, setIncomingRequestIds] = useState<string[]>([])
  const [outgoingRequestIds, setOutgoingRequestIds] = useState<string[]>([])
  const [blockedIds, setBlockedIds] = useState<string[]>([])
  const [blockedByIds, setBlockedByIds] = useState<string[]>([])
  const [tradePartnerIds, setTradePartnerIds] = useState<string[]>([])
  const [reviewsByUser, setReviewsByUser] = useState<Record<string, Review[]>>({})
  const [profileCache, setProfileCache] = useState<Record<string, User>>({})
  const [trades, setTrades] = useState<Trade[]>([])
  const [allTrades, setAllTrades] = useState<Trade[]>([])
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
      setIncomingRequestIds([])
      setOutgoingRequestIds([])
      return
    }
    const res = await fetch("/api/friends", { credentials: "same-origin" })
    if (!res.ok) return
    const data = (await res.json()) as {
      friendIds?: string[]
      profiles?: User[]
      incomingRequestIds?: string[]
      outgoingRequestIds?: string[]
    }
    setFriendIds(data.friendIds ?? [])
    setIncomingRequestIds(data.incomingRequestIds ?? [])
    setOutgoingRequestIds(data.outgoingRequestIds ?? [])
    if (data.profiles?.length) {
      setProfileCache((prev) => {
        const next = { ...prev }
        for (const p of data.profiles!) next[p.id] = p
        return next
      })
    }
  }, [user])

  const refreshBlocks = useCallback(async () => {
    if (!user) {
      setBlockedIds([])
      setBlockedByIds([])
      return
    }
    const res = await fetch("/api/blocks", { credentials: "same-origin" })
    if (!res.ok) return
    const data = (await res.json()) as { blockedIds?: string[]; blockedByIds?: string[] }
    setBlockedIds(data.blockedIds ?? [])
    setBlockedByIds(data.blockedByIds ?? [])
  }, [user])

  const refreshTrades = useCallback(async () => {
    if (!user) {
      setTrades([])
      setAllTrades([])
      setTradePartnerIds([])
      return
    }
    const res = await fetch("/api/trades", { credentials: "same-origin" })
    if (!res.ok) return
    const data = (await res.json()) as { trades: Trade[]; allTrades?: Trade[] }
    const everyTrade = data.allTrades ?? data.trades
    setTrades(data.trades)
    setAllTrades(everyTrade)
    const partners = new Set<string>()
    for (const t of everyTrade) {
      if (t.status !== "completed") continue
      partners.add(t.initiatorId === user.id ? t.recipientId : t.initiatorId)
    }
    setTradePartnerIds([...partners])
  }, [user])

  useEffect(() => {
    if (authLoading) return
    void refreshProfile()
    void refreshFriends()
    void refreshBlocks()
    void refreshTrades()
  }, [authLoading, refreshProfile, refreshFriends, refreshBlocks, refreshTrades])

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
        const res = await fetch("/api/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ userId: id }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) return data.error ?? "Could not send friend request"
        await refreshFriends()
        return null
      } catch {
        return "Could not send friend request"
      }
    },
    [user, refreshFriends],
  )

  const acceptFriendRequest = useCallback(
    async (id: string): Promise<string | null> => {
      if (!user) return "Sign in required"
      try {
        const res = await fetch("/api/friends", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ userId: id, action: "accept" }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) return data.error ?? "Could not accept request"
        await refreshFriends()
        return null
      } catch {
        return "Could not accept request"
      }
    },
    [user, refreshFriends],
  )

  const declineFriendRequest = useCallback(
    async (id: string): Promise<string | null> => {
      if (!user) return "Sign in required"
      try {
        const res = await fetch("/api/friends", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ userId: id, action: "decline" }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) return data.error ?? "Could not decline request"
        await refreshFriends()
        return null
      } catch {
        return "Could not decline request"
      }
    },
    [user, refreshFriends],
  )

  const removeFriend = useCallback(
    async (id: string): Promise<string | null> => {
      if (!user) return "Sign in required"
      try {
        const res = await fetch(`/api/friends?userId=${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "same-origin",
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) return data.error ?? "Could not remove friend"
        await refreshFriends()
        return null
      } catch {
        return "Could not remove friend"
      }
    },
    [user, refreshFriends],
  )

  const blockUser = useCallback(
    async (id: string): Promise<string | null> => {
      if (!user) return "Sign in required"
      try {
        const res = await fetch("/api/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ userId: id }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          blockedIds?: string[]
          blockedByIds?: string[]
        }
        if (!res.ok) return data.error ?? "Could not block user"
        setBlockedIds(data.blockedIds ?? [])
        setBlockedByIds(data.blockedByIds ?? [])
        await Promise.all([refreshFriends(), refreshTrades()])
        return null
      } catch {
        return "Could not block user"
      }
    },
    [user, refreshFriends, refreshTrades],
  )

  const unblockUser = useCallback(
    async (id: string): Promise<string | null> => {
      if (!user) return "Sign in required"
      try {
        const res = await fetch(`/api/blocks?userId=${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "same-origin",
        })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          blockedIds?: string[]
          blockedByIds?: string[]
        }
        if (!res.ok) return data.error ?? "Could not unblock user"
        setBlockedIds(data.blockedIds ?? [])
        setBlockedByIds(data.blockedByIds ?? [])
        return null
      } catch {
        return "Could not unblock user"
      }
    },
    [user],
  )

  const reportUser = useCallback(
    async (id: string, reason: ReportReason, details: string): Promise<string | null> => {
      if (!user) return "Sign in required"
      try {
        const res = await fetch("/api/reports/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ userId: id, reason, details }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) return data.error ?? "Could not submit report"
        return null
      } catch {
        return "Could not submit report"
      }
    },
    [user],
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
      incomingRequestIds,
      outgoingRequestIds,
      pendingFriendRequestCount: incomingRequestIds.length,
      friendshipStatus: (id: string): FriendshipStatus => {
        if (friendIds.includes(id)) return "accepted"
        if (incomingRequestIds.includes(id)) return "pending_incoming"
        if (outgoingRequestIds.includes(id)) return "pending_outgoing"
        return "none"
      },
      isFriend: (id) => friendIds.includes(id),
      addFriend,
      acceptFriendRequest,
      declineFriendRequest,
      removeFriend,
      blockedIds,
      blockedByIds,
      isBlocked: (id) => blockedIds.includes(id),
      isBlockedBy: (id) => blockedByIds.includes(id),
      cannotInteract: (id) => blockedIds.includes(id) || blockedByIds.includes(id),
      blockUser,
      unblockUser,
      reportUser,
      refreshBlocks,
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
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          return data.error ?? "Could not save review"
        }
        await loadReviews(userId)
        return null
      },
      loadReviews,
      getCachedProfile,
      cacheProfile,
      trades,
      allTrades,
      pendingTradeCount: trades.filter(
        (t) => currentUser && tradeNeedsMyAcceptance(t, currentUser.id),
      ).length,
      acceptedTradeCount: allTrades.filter(isTradeAcceptedForDisplay).length,
      refreshTrades,
      refreshFriends,
      refreshProfile,
      openFriends: () => setPanel({ type: "friends" }),
      openMessages: () => setPanel({ type: "messages" }),
      openAcceptedTrades: () => setPanel({ type: "accepted-trades" }),
      openProfile: (id) => {
        setPanel({ type: "profile", userId: id })
        void loadReviews(id)
      },
      openTradeComposer: (userId, prefill) =>
        setPanel({
          type: "trade-composer",
          userId,
          prefillMyIds: prefill?.myIds,
          prefillTheirIds: prefill?.theirIds,
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
    incomingRequestIds,
    outgoingRequestIds,
    blockedIds,
    blockedByIds,
    tradePartnerIds,
    reviewsByUser,
    profileCache,
    trades,
    allTrades,
    addFriend,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    blockUser,
    unblockUser,
    reportUser,
    refreshBlocks,
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
      {panel?.type === "accepted-trades" && <AcceptedTradesPanel />}
      {panel?.type === "profile" && <ProfilePanel userId={panel.userId} />}
      {panel?.type === "trade-composer" && (
        <TradeComposerPanel
          userId={panel.userId}
          prefillMyIds={panel.prefillMyIds}
          prefillTheirIds={panel.prefillTheirIds}
        />
      )}
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
