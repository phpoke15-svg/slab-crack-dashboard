"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeftRight, Loader2, RefreshCw, Sparkles, User } from "lucide-react"
import { computeMatchSuggestions } from "@/lib/trade-binder/matching"
import type { MatchSuggestion } from "@/lib/trade-binder/users"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useOptionalSocial } from "./social-provider"
import { UserAvatar } from "./user-avatar"

type MatchesPanelProps = {
  active?: boolean
  onCountChange?: (count: number) => void
}

export function MatchesPanel({ active = true, onCountChange }: MatchesPanelProps) {
  const { user, getSupabase } = useAuth()
  const social = useOptionalSocial()
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myHaveCount, setMyHaveCount] = useState(0)
  const [myWantCount, setMyWantCount] = useState(0)

  const loadMatches = useCallback(async () => {
    if (!user) {
      setSuggestions([])
      onCountChange?.(0)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await computeMatchSuggestions(getSupabase(), user.id)
      if (result.error) {
        setError(result.error)
        setSuggestions([])
        onCountChange?.(0)
      } else {
        setSuggestions(result.suggestions)
        setMyHaveCount(result.myHaveCount)
        setMyWantCount(result.myWantCount)
        onCountChange?.(result.suggestions.length)
        for (const s of result.suggestions) social?.cacheProfile(s.profile)
      }
    } catch {
      setError("Could not load matches.")
      setSuggestions([])
      onCountChange?.(0)
    } finally {
      setLoading(false)
    }
  }, [user, getSupabase, social, onCountChange])

  useEffect(() => {
    if (active && user) void loadMatches()
  }, [active, user, loadMatches])

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

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {myHaveCount > 0 || myWantCount > 0
            ? `${myWantCount} wanted · ${myHaveCount} for trade`
            : "Add cards to I have and I want to start matching"}
        </p>
        <button
          type="button"
          onClick={() => void loadMatches()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
        >
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading && suggestions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Finding collectors with overlapping cards…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-6 py-10 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/60 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
            <Sparkles className="size-6" />
          </span>
          <p className="text-base font-semibold text-foreground">No matches yet</p>
          <div className="max-w-sm text-sm text-muted-foreground text-pretty space-y-2">
            <p>For a match to appear, you need:</p>
            <ol className="list-decimal space-y-1 pl-5 text-left">
              <li>
                Cards in <span className="text-trade">I have</span> and/or{" "}
                <span className="text-wishlist">I want</span> on this account
              </li>
              <li>
                Another collector with the <strong>same card</strong> in the opposite list
                (add from Search so card IDs match)
              </li>
              <li>
                Their binder visibility set to <strong>Public</strong> or{" "}
                <strong>Friends</strong> (My profile → Binder visibility)
              </li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
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
                  onClick={() => social?.openProfile(match.userId)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                >
                  <ArrowLeftRight className="size-3.5" /> Propose trade
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
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
