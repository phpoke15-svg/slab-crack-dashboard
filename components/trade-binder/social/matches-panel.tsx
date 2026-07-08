"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeftRight, Loader2, RefreshCw, Sparkles, User } from "lucide-react"
import { computeMatchSuggestions } from "@/lib/trade-binder/matching"
import {
  formatUsd,
  MATCH_VALUE_TOLERANCE_DEFAULT,
  MATCH_VALUE_TOLERANCE_MAX,
  MATCH_VALUE_TOLERANCE_MIN,
} from "@/lib/trade-binder/match-value"
import type { MatchSuggestion } from "@/lib/trade-binder/users"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useOptionalSocial } from "./social-provider"
import { UserAvatar } from "./user-avatar"
import { cn } from "@/lib/utils"

type MatchesPanelProps = {
  active?: boolean
  onCountChange?: (count: number) => void
}

const TOLERANCE_OPTIONS = [
  { label: "5%", value: MATCH_VALUE_TOLERANCE_MIN },
  { label: "6%", value: 0.06 },
  { label: "7%", value: 0.07 },
  { label: "8%", value: 0.08 },
  { label: "9%", value: 0.09 },
  { label: "10%", value: MATCH_VALUE_TOLERANCE_MAX },
] as const

export function MatchesPanel({ active = true, onCountChange }: MatchesPanelProps) {
  const { user, getSupabase } = useAuth()
  const social = useOptionalSocial()
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myHaveCount, setMyHaveCount] = useState(0)
  const [myWantCount, setMyWantCount] = useState(0)
  const [pricesLoaded, setPricesLoaded] = useState(false)
  const [valueTolerance, setValueTolerance] = useState(MATCH_VALUE_TOLERANCE_DEFAULT)

  const loadMatches = useCallback(async () => {
    if (!user) {
      setSuggestions([])
      onCountChange?.(0)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await computeMatchSuggestions(getSupabase(), user.id, valueTolerance)
      if (result.error) {
        setError(result.error)
        setSuggestions([])
        onCountChange?.(0)
      } else {
        setSuggestions(result.suggestions)
        setMyHaveCount(result.myHaveCount)
        setMyWantCount(result.myWantCount)
        setPricesLoaded(result.pricesLoaded)
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
  }, [user, getSupabase, social, onCountChange, valueTolerance])

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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">Max value gap:</span>
        {TOLERANCE_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => setValueTolerance(opt.value)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
              valueTolerance === opt.value
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && suggestions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Finding fair-value trade matches…</p>
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
          <p className="text-base font-semibold text-foreground">No fair matches yet</p>
          <div className="max-w-sm text-sm text-muted-foreground text-pretty space-y-2">
            <p>
              Matches require overlapping cards <strong>and</strong> similar raw values (within{" "}
              {Math.round(valueTolerance * 100)}%).
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-left">
              <li>
                Add cards to <span className="text-trade">I have</span> and{" "}
                <span className="text-wishlist">I want</span>
              </li>
              <li>Another collector needs the opposite lists with similar card values</li>
              <li>Both binders set to <strong>Public</strong> or <strong>Friends</strong></li>
            </ol>
            {!pricesLoaded && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Card prices could not be loaded — matching needs PriceCharting prices.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {suggestions.length} fair match{suggestions.length === 1 ? "" : "es"} within{" "}
            {Math.round(valueTolerance * 100)}% value
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
                  {match.fairPairs.length} fair pair{match.fairPairs.length === 1 ? "" : "s"}
                </span>
              </div>

              <ul className="mt-3 space-y-2">
                {match.fairPairs.slice(0, 6).map((pair) => (
                  <li
                    key={`${pair.theyOffer.cardId}-${pair.youOffer.cardId}`}
                    className="rounded-xl border border-border bg-secondary/30 p-2.5 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-wishlist">
                          You get
                        </p>
                        <p className="truncate font-medium text-foreground">
                          {pair.theyOffer.cardName}
                        </p>
                        {pair.theyOffer.rawPrice ? (
                          <p className="text-xs text-muted-foreground">
                            {formatUsd(pair.theyOffer.rawPrice)}
                          </p>
                        ) : null}
                      </div>
                      <ArrowLeftRight className="mt-4 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1 text-right">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-trade">
                          You give
                        </p>
                        <p className="truncate font-medium text-foreground">
                          {pair.youOffer.cardName}
                        </p>
                        {pair.youOffer.rawPrice ? (
                          <p className="text-xs text-muted-foreground">
                            {formatUsd(pair.youOffer.rawPrice)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-1.5 text-center text-[10px] text-primary">
                      {pair.valueDiffPercent.toFixed(1)}% value difference
                    </p>
                  </li>
                ))}
                {match.fairPairs.length > 6 && (
                  <li className="text-center text-xs text-muted-foreground">
                    +{match.fairPairs.length - 6} more fair pairs
                  </li>
                )}
              </ul>

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
