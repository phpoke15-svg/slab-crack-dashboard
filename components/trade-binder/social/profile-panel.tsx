"use client"

import { useState } from "react"
import { MapPin, UserPlus, UserCheck, MessageSquarePlus, Lock, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { CURRENT_USER_ID } from "@/lib/trade-binder/users"
import { useSocial } from "./social-provider"
import { PanelShell } from "./panel-shell"
import { UserAvatar } from "./user-avatar"
import { StarRating, StarInput } from "./star-rating"

export function ProfilePanel({ userId }: { userId: string }) {
  const social = useSocial()
  const user = social.getUser(userId)

  if (!user) {
    return (
      <PanelShell title="Profile" onClose={social.close}>
        <div className="p-6 text-sm text-muted-foreground">Trader not found.</div>
      </PanelShell>
    )
  }

  const isSelf = userId === CURRENT_USER_ID
  const isFriend = social.isFriend(userId)
  const hasTraded = social.hasTradedWith(userId)
  const reviews = social.reviewsFor(userId)
  const rating = social.ratingFor(userId)

  return (
    <PanelShell title="Profile" onClose={social.close}>
      <section className="border-b border-border p-4 sm:px-6">
        <div className="flex items-start gap-4">
          <UserAvatar user={user} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold leading-tight text-foreground text-balance">
              {user.name}
              {isSelf && (
                <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                  You
                </span>
              )}
            </h3>
            <p className="text-[11px] text-muted-foreground">{user.handle}</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="size-3" aria-hidden="true" />
              {user.location}
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-foreground/90 text-pretty">{user.bio}</p>

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

        {!isSelf && (
          <button
            type="button"
            onClick={() => (isFriend ? social.removeFriend(userId) : social.addFriend(userId))}
            className={cn(
              "mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
        )}
      </section>

      <section className="p-4 sm:px-6">
        <h4 className="mb-3 text-sm font-semibold text-foreground">Reviews</h4>

        {!isSelf && <ReviewComposer userId={userId} hasTraded={hasTraded} />}

        {reviews.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {reviews.map((r) => {
              const author = social.getUser(r.authorId)
              return (
                <li key={r.id} className="rounded-xl border border-border bg-card/60 p-3">
                  <div className="flex items-center gap-2">
                    {author && <UserAvatar user={author} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {author?.name ?? "Unknown"}
                        {r.authorId === CURRENT_USER_ID && (
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

function ReviewComposer({ userId, hasTraded }: { userId: string; hasTraded: boolean }) {
  const social = useSocial()
  const alreadyReviewed = social.hasReviewed(userId)
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")

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

  const submit = () => {
    if (rating < 1) return
    social.addReview(userId, rating, comment)
    setOpen(false)
    setRating(0)
    setComment("")
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
          disabled={rating < 1}
          className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          Submit
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
