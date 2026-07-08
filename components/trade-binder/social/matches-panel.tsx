"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeftRight, Loader2, Sparkles, User } from "lucide-react"
import type { MatchSuggestion } from "@/lib/trade-binder/users"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useOptionalSocial } from "./social-provider"
import { UserAvatar } from "./user-avatar"

export function MatchesPanel() {
  const { user } = useAuth()
  const social = useOptionalSocial()
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setSuggestions([])
      return
    }

    setLoading(true)
    setError(null)
    fetch("/api/match/suggestions")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load matches")
        return res.json()
      })
      .then((data: { suggestions: MatchSuggestion[] }) => {
        const list = data.suggestions ?? []
        setSuggestions(list)
        for (const s of list) social?.cacheProfile(s.profile)
      })
      .catch(() => setError("Could not load matches. Make sure you have cards in I have and I want."))
      .finally(() => setLoading(false))
  }, [user, social?.cacheProfile])

  if (!user) {
    return (
      <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/60 px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">Sign in to see trade matches.</p>
        <Link
          href="/sign-in?next=/binder"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Sign in
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Finding collectors with overlapping cards…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-8 rounded-2xl border border-destructive/40 bg-destructive/10 px-6 py-10 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/60 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
          <Sparkles className="size-6" />
        </span>
        <p className="text-base font-semibold text-foreground">No matches yet</p>
        <p className="text-sm text-muted-foreground text-pretty">
          Add cards to <span className="text-trade">I have</span> and{" "}
          <span className="text-wishlist">I want</span>. When another collector has what you want (or
          wants what you have), they&apos;ll show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-muted-foreground">
        {suggestions.length} collector{suggestions.length === 1 ? "" : "s"} with overlapping cards
      </p>
      {suggestions.map((match) => (
        <article
          key={match.userId}
          className="rounded-2xl border border-border bg-card/60 p-4"
        >
          <div className="flex items-start gap-3">
            <UserAvatar user={match.profile} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => social?.openProfile(match.userId)}
                  className="truncate text-sm font-semibold text-foreground hover:text-primary"
                >
                  {match.profile.name}
                </button>
                {match.isFriend && (
                  <span className="rounded-full bg-trade/15 px-2 py-0.5 text-[10px] font-medium text-trade">
                    Friend
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{match.profile.handle}</p>
            </div>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {match.score} pt{match.score === 1 ? "" : "s"}
            </span>
          </div>

          {match.theyHaveYouWant.length > 0 && (
            <MatchCardList
              title="They have · you want"
              cards={match.theyHaveYouWant}
              className="text-wishlist"
            />
          )}
          {match.youHaveTheyWant.length > 0 && (
            <MatchCardList
              title="You have · they want"
              cards={match.youHaveTheyWant}
              className="text-trade"
            />
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => social?.openProfile(match.userId)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium transition-colors hover:border-primary/40"
            >
              <User className="size-3.5" /> View profile
            </button>
            <button
              type="button"
              onClick={() => social?.openTrades()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
            >
              <ArrowLeftRight className="size-3.5" /> Trades
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

function MatchCardList({
  title,
  cards,
  className,
}: {
  title: string
  cards: MatchSuggestion["theyHaveYouWant"]
  className: string
}) {
  return (
    <div className="mt-3">
      <p className={`mb-1 text-[11px] font-medium ${className}`}>{title}</p>
      <ul className="space-y-1">
        {cards.slice(0, 5).map((c) => (
          <li key={c.cardId} className="truncate text-sm text-foreground">
            {c.cardName}
            {c.cardSet ? <span className="text-muted-foreground"> · {c.cardSet}</span> : null}
          </li>
        ))}
        {cards.length > 5 && (
          <li className="text-xs text-muted-foreground">+{cards.length - 5} more</li>
        )}
      </ul>
    </div>
  )
}
