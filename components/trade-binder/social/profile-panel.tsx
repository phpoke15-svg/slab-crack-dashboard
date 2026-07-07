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
        <div className="p-6 font-mono text-sm text-muted-foreground">Trader not found.</div>
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
      {/* Identity block */}
      <section className="border-b-2 border-border p-4">
        <div className="flex items-start gap-4">
          <UserAvatar user={user} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-xl font-bold uppercase leading-tight tracking-wide text-card-foreground text-balance">
              {user.name}
              {isSelf && <span className="ml-2 font-mono text-[10px] tracking-widest text-primary">(YOU)</span>}
            </h3>
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{user.handle}</p>
            <p className="mt-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <MapPin className="size-3" aria-hidden="true" />
              {user.location}
            </p>
          </div>
        </div>

        <p className="mt-3 font-mono text-xs leading-relaxed text-foreground/90 text-pretty">{user.bio}</p>

        {/* Rating summary */}
        <div className="mt-4 flex items-center gap-3 rounded-xs border-2 border-border bg-secondary p-3">
          <div className="flex flex-col items-center border-r-2 border-border pr-3">
            <span className="font-serif text-3xl font-bold leading-none text-primary">
              {rating > 0 ? rating.toFixed(1) : "—"}
            </span>
            <span className="mt-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">out of 5</span>
          </div>
          <div className="min-w-0">
            <StarRating value={rating} size="md" />
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {reviews.length} review{reviews.length === 1 ? "" : "s"} from traders
            </p>
          </div>
        </div>

        {/* Friend action */}
        {!isSelf && (
          <button
            type="button"
            onClick={() => (isFriend ? social.removeFriend(userId) : social.addFriend(userId))}
            className={cn(
              "mt-3 flex w-full items-center justify-center gap-2 rounded-xs border-2 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_0_var(--border)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:translate-y-0.5",
              isFriend
                ? "border-trade/70 bg-trade/15 text-trade"
                : "border-primary/70 bg-primary text-primary-foreground",
            )}
          >
            {isFriend ? (
              <>
                <UserCheck className="size-4" aria-hidden="true" /> Friends
              </>
            ) : (
              <>
                <UserPlus className="size-4" aria-hidden="true" /> Add Friend
              </>
            )}
          </button>
        )}
      </section>

      {/* Reviews */}
      <section className="p-4">
        <h4 className="mb-3 font-serif text-base font-bold uppercase tracking-widest text-card-foreground">Reviews</h4>

        {!isSelf && <ReviewComposer userId={userId} hasTraded={hasTraded} />}

        {reviews.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {reviews.map((r) => {
              const author = social.getUser(r.authorId)
              return (
                <li key={r.id} className="rounded-xs border-2 border-border bg-secondary p-3">
                  <div className="flex items-center gap-2">
                    {author && <UserAvatar user={author} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-xs font-bold uppercase tracking-wide text-card-foreground">
                        {author?.name ?? "Unknown"}
                        {r.authorId === CURRENT_USER_ID && (
                          <span className="ml-1.5 font-mono text-[9px] tracking-widest text-primary">(YOU)</span>
                        )}
                      </p>
                      <StarRating value={r.rating} size="sm" />
                    </div>
                    <time className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      {r.createdAt}
                    </time>
                  </div>
                  {r.comment && (
                    <p className="mt-2 font-mono text-xs leading-relaxed text-foreground/90 text-pretty">{r.comment}</p>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-border bg-secondary px-6 py-10 text-center">
            <span className="flex size-10 items-center justify-center rounded-xs border-2 border-border bg-card text-muted-foreground">
              <Star className="size-5" aria-hidden="true" />
            </span>
            <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground text-pretty">No reviews yet</p>
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

  // Only traders who have completed a trade with this person can leave a review.
  if (!hasTraded) {
    return (
      <div className="flex items-center gap-2 rounded-xs border-2 border-dashed border-border bg-secondary/50 p-3">
        <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground text-pretty">
          Complete a trade with this trader to leave a review
        </p>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xs border-2 border-border bg-secondary px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-card-foreground transition-colors hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessageSquarePlus className="size-4" aria-hidden="true" />
        {alreadyReviewed ? "Edit Your Review" : "Write A Review"}
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
    <div className="rounded-xs border-2 border-primary/50 bg-secondary p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your rating</p>
      <StarInput value={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="SHARE HOW THE TRADE WENT..."
        aria-label="Review comment"
        className="mt-3 w-full resize-none rounded-xs border-2 border-border bg-input p-2.5 font-mono text-xs uppercase tracking-wide text-foreground placeholder:text-muted-foreground placeholder:tracking-widest focus-visible:border-primary focus-visible:outline-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={rating < 1}
          className="flex-1 rounded-xs border-2 border-primary/70 bg-primary px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-40"
        >
          Submit
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xs border-2 border-border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
