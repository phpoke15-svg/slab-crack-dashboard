"use client"

import { useEffect, useState } from "react"
import {
  MapPin,
  UserPlus,
  UserCheck,
  MessageSquarePlus,
  Lock,
  Star,
  ArrowLeftRight,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { TcgCard } from "@/lib/trade-binder/cards"
import type { MatchCard } from "@/lib/trade-binder/users"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useSocial } from "./social-provider"
import { PanelShell } from "./panel-shell"
import { UserAvatar } from "./user-avatar"
import { StarRating, StarInput } from "./star-rating"
import { ProfileEditor } from "./profile-editor"

export function ProfilePanel({ userId }: { userId: string }) {
  const social = useSocial()
  const { user: authUser } = useAuth()
  const [profile, setProfile] = useState(social.getCachedProfile(userId) ?? null)
  const [loading, setLoading] = useState(!profile)
  const [binderTrade, setBinderTrade] = useState<TcgCard[]>([])
  const [binderWishlist, setBinderWishlist] = useState<TcgCard[]>([])
  const [binderLoading, setBinderLoading] = useState(false)
  const [tradeMessage, setTradeMessage] = useState("")
  const [tradeSending, setTradeSending] = useState(false)
  const [tradeError, setTradeError] = useState<string | null>(null)
  const [tradeSuccess, setTradeSuccess] = useState(false)
  const [friendBusy, setFriendBusy] = useState(false)
  const [friendError, setFriendError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/profile/${encodeURIComponent(userId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.profile) return
        setProfile(data.profile)
        social.cacheProfile(data.profile)
        if (data.reviews) {
          void social.loadReviews(userId)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, social])

  useEffect(() => {
    let cancelled = false
    setBinderLoading(true)
    fetch(`/api/binder/${encodeURIComponent(userId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setBinderTrade(data.trade ?? [])
        setBinderWishlist(data.wishlist ?? [])
      })
      .finally(() => {
        if (!cancelled) setBinderLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loading && !profile) {
    return (
      <PanelShell title="Profile" onClose={social.close}>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </PanelShell>
    )
  }

  if (!profile) {
    return (
      <PanelShell title="Profile" onClose={social.close}>
        <div className="p-6 text-sm text-muted-foreground">Trader not found.</div>
      </PanelShell>
    )
  }

  const isSelf = authUser?.id === userId
  const isFriend = social.isFriend(userId)
  const hasTraded = social.hasTradedWith(userId)
  const reviews = social.reviewsFor(userId)
  const rating = social.ratingFor(userId)

  const proposeTrade = async (myItems: MatchCard[], theirItems: MatchCard[]) => {
    if (!authUser || myItems.length === 0 && theirItems.length === 0) return
    setTradeSending(true)
    setTradeError(null)
    setTradeSuccess(false)
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: userId,
          message: tradeMessage,
          myItems: myItems.map((c) => ({
            cardId: c.cardId,
            cardName: c.cardName,
            cardSet: c.cardSet,
            cardImage: c.cardImage,
          })),
          theirItems: theirItems.map((c) => ({
            cardId: c.cardId,
            cardName: c.cardName,
            cardSet: c.cardSet,
            cardImage: c.cardImage,
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTradeError(data.error ?? "Could not send trade proposal")
        return
      }
      setTradeSuccess(true)
      await social.refreshTrades()
    } finally {
      setTradeSending(false)
    }
  }

  return (
    <PanelShell title="Profile" onClose={social.close}>
      <section className="border-b border-border p-4 sm:px-6">
        {isSelf ? (
          <ProfileEditor profile={profile} onSaved={(p) => setProfile(p)} />
        ) : (
          <>
            <div className="flex items-start gap-4">
              <UserAvatar user={profile} size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold leading-tight text-foreground text-balance">
                  {profile.name}
                </h3>
                <p className="text-[11px] text-muted-foreground">{profile.handle}</p>
                {profile.location && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="size-3" aria-hidden="true" />
                    {profile.location}
                  </p>
                )}
              </div>
            </div>

            {profile.bio && (
              <p className="mt-3 text-sm leading-relaxed text-foreground/90 text-pretty">{profile.bio}</p>
            )}

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3">
              <div className="flex flex-col items-center border-r border-border pr-3">
                <span className="text-3xl font-bold leading-none text-primary">
                  {rating > 0 ? rating.toFixed(1) : "—"}
                </span>
                <span className="mt-1 text-[10px] text-muted-foreground">out of 5</span>
              </div>
              <div className="min-w-0">
                <StarRating value={rating} size="md" />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {reviews.length} review{reviews.length === 1 ? "" : "s"} from traders
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={friendBusy}
              onClick={(event) => {
                event.stopPropagation()
                setFriendBusy(true)
                setFriendError(null)
                void (async () => {
                  try {
                    const err = isFriend
                      ? await social.removeFriend(userId)
                      : await social.addFriend(userId)
                    if (err) setFriendError(err)
                  } catch {
                    setFriendError("Something went wrong")
                  } finally {
                    setFriendBusy(false)
                  }
                })()
              }}
              className={cn(
                "mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                isFriend
                  ? "border border-trade/50 bg-trade/15 text-trade"
                  : "bg-primary text-primary-foreground",
              )}
            >
              {isFriend ? (
                <>
                  <UserCheck className="size-4" aria-hidden="true" /> Friends
                </>
              ) : (
                <>
                  <UserPlus className="size-4" aria-hidden="true" /> Add friend
                </>
              )}
            </button>
            {friendError && <p className="mt-2 text-sm text-destructive">{friendError}</p>}
          </>
        )}
      </section>

      {!isSelf && (
        <section className="border-b border-border p-4 sm:px-6">
          <h4 className="mb-3 text-sm font-semibold text-foreground">Binder</h4>
          {binderLoading ? (
            <p className="text-sm text-muted-foreground">Loading binder…</p>
          ) : binderTrade.length === 0 && binderWishlist.length === 0 ? (
            <p className="text-sm text-muted-foreground">This trader&apos;s binder is empty or private.</p>
          ) : (
            <div className="space-y-3">
              {binderTrade.length > 0 && (
                <BinderList title="I have" cards={binderTrade} variant="trade" />
              )}
              {binderWishlist.length > 0 && (
                <BinderList title="I want" cards={binderWishlist} variant="wishlist" />
              )}
              <textarea
                value={tradeMessage}
                onChange={(e) => setTradeMessage(e.target.value)}
                rows={2}
                placeholder="Optional message with your trade proposal…"
                className="w-full resize-none rounded-xl border border-border bg-secondary/60 p-2.5 text-sm outline-none focus:border-primary/50"
              />
              {tradeError && <p className="text-sm text-destructive">{tradeError}</p>}
              {tradeSuccess && (
                <p className="text-sm text-trade">Trade proposal sent!</p>
              )}
              <button
                type="button"
                disabled={tradeSending}
                onClick={() =>
                  proposeTrade(
                    binderWishlist.map((c) => ({
                      cardId: c.id,
                      cardName: c.name,
                      cardSet: c.set,
                      cardImage: c.image,
                    })),
                    binderTrade.map((c) => ({
                      cardId: c.id,
                      cardName: c.name,
                      cardSet: c.set,
                      cardImage: c.image,
                    })),
                  )
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {tradeSending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowLeftRight className="size-4" />
                )}
                Propose trade
              </button>
            </div>
          )}
        </section>
      )}

      <section className="p-4 sm:px-6">
        <h4 className="mb-3 text-sm font-semibold text-foreground">Reviews</h4>
        {!isSelf && <ReviewComposer userId={userId} hasTraded={hasTraded} />}
        {reviews.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {reviews.map((r) => {
              const author = social.getCachedProfile(r.authorId)
              return (
                <li key={r.id} className="rounded-xl border border-border bg-card/60 p-3">
                  <div className="flex items-center gap-2">
                    {author && <UserAvatar user={author} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {author?.name ?? "Trader"}
                        {social.currentUser?.id === r.authorId && (
                          <span className="ml-1.5 text-[10px] text-primary">(you)</span>
                        )}
                      </p>
                      <StarRating value={r.rating} size="sm" />
                    </div>
                    <time className="shrink-0 text-[10px] text-muted-foreground">{r.createdAt}</time>
                  </div>
                  {r.comment && (
                    <p className="mt-2 text-sm leading-relaxed text-foreground/90 text-pretty">{r.comment}</p>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card/60 px-6 py-10 text-center">
            <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
              <Star className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted-foreground">No reviews yet</p>
          </div>
        )}
      </section>
    </PanelShell>
  )
}

function BinderList({
  title,
  cards,
  variant,
}: {
  title: string
  cards: TcgCard[]
  variant: "trade" | "wishlist"
}) {
  return (
    <div>
      <p className={cn("mb-1 text-xs font-medium", variant === "trade" ? "text-trade" : "text-wishlist")}>
        {title} · {cards.length}
      </p>
      <ul className="flex flex-col gap-1">
        {cards.slice(0, 8).map((c) => (
          <li key={c.id} className="truncate text-sm text-foreground">
            {c.name}
            {c.set ? <span className="text-muted-foreground"> · {c.set}</span> : null}
          </li>
        ))}
        {cards.length > 8 && (
          <li className="text-xs text-muted-foreground">+{cards.length - 8} more</li>
        )}
      </ul>
    </div>
  )
}

function ReviewComposer({ userId, hasTraded }: { userId: string; hasTraded: boolean }) {
  const social = useSocial()
  const alreadyReviewed = social.hasReviewed(userId)
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)

  if (!hasTraded) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-secondary/40 p-3">
        <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground text-pretty">
          Complete a trade with this trader to leave a review.
        </p>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessageSquarePlus className="size-4" aria-hidden="true" />
        {alreadyReviewed ? "Edit your review" : "Write a review"}
      </button>
    )
  }

  const submit = async () => {
    if (rating < 1) return
    setSaving(true)
    try {
      await social.addReview(userId, rating, comment)
      setOpen(false)
      setRating(0)
      setComment("")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-card/60 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Your rating</p>
      <StarInput value={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Share how the trade went…"
        aria-label="Review comment"
        className="mt-3 w-full resize-none rounded-xl border border-border bg-secondary/60 p-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50 focus:bg-secondary"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={rating < 1 || saving}
          className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          {saving ? "Saving…" : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
