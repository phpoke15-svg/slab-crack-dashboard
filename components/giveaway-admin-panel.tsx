"use client"

import { useEffect, useState } from "react"
import { Gift, Loader2, Mail } from "lucide-react"
import { GIVEAWAY_PRIZE_PER_ACCOUNT_USD } from "@/lib/giveaway/constants"

type PrizePayload = {
  monthPeriod: string
  snapshotAt: string
  snapshotDate?: string
  accountSnapshot: number
  prizePerAccountUsd: number
  prizeArvUsd: number
  isMonthEndFinal?: boolean
}

type DrawRow = {
  monthPeriod: string
  winnerHandle: string | null
  totalEntries: number
  accountSnapshot: number | null
  prizeArvUsd: number | null
}

function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export function GiveawayAdminPanel() {
  const [user, setUser] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prize, setPrize] = useState<PrizePayload | null>(null)
  const [draws, setDraws] = useState<DrawRow[]>([])
  const [prizeLoading, setPrizeLoading] = useState(true)

  useEffect(() => {
    fetch("/api/giveaway/prize", { credentials: "same-origin" })
      .then((r) => r.json())
      .then(
        (json: {
          ok?: boolean
          prize?: PrizePayload
          recentDraws?: DrawRow[]
          error?: string
        }) => {
          if (json.ok && json.prize) setPrize(json.prize)
          if (json.ok && json.recentDraws) setDraws(json.recentDraws)
        },
      )
      .catch(() => {})
      .finally(() => setPrizeLoading(false))
  }, [])

  const submit = async () => {
    setLoading(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch("/api/giveaway/mail-in", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user.trim(), notes }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        entriesAdded?: number
        reason?: string
      }
      if (!res.ok || !json.ok) {
        throw new Error(json.error || json.reason || "Mail-in failed")
      }
      setMessage(`Added ${json.entriesAdded ?? 0} entries for ${user.trim()}`)
      setUser("")
      setNotes("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mail-in failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Gift className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Giveaway — prize value</h2>
        </div>
        {prizeLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Calculating prize ARV…
          </div>
        ) : prize ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              <strong className="text-foreground">{prize.monthPeriod}</strong>
              {prize.snapshotDate ? (
                <>
                  {" "}
                  — running total as of{" "}
                  <strong className="text-foreground">{prize.snapshotDate}</strong>
                  {prize.isMonthEndFinal ? " (official month-end total)" : ""}
                </>
              ) : (
                " — awaiting first daily snapshot"
              )}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border bg-background p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Accounts</p>
                <p className="text-lg font-bold">{prize.accountSnapshot.toLocaleString("en-US")}</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Prize ARV</p>
                <p className="text-lg font-bold">{formatUsd(prize.prizeArvUsd)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {prize.accountSnapshot.toLocaleString("en-US")} × {formatUsd(GIVEAWAY_PRIZE_PER_ACCOUNT_USD)} per
              account · updated daily; last day of month is the official prize value
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Prize data unavailable.</p>
        )}
        {draws.length ? (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold text-foreground">Recent draws</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {draws.map((draw) => (
                <li key={draw.monthPeriod}>
                  {draw.monthPeriod}: {draw.winnerHandle ? `@${draw.winnerHandle}` : "no winner"} ·{" "}
                  {draw.totalEntries} entries
                  {draw.prizeArvUsd != null ? ` · ${formatUsd(draw.prizeArvUsd)} prize` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Mail className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Giveaway — AMOE mail-in</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Process a postcard: 7 entries each, max 4/month per user, 28/month total cap.
        </p>
        <div className="space-y-2">
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="User handle or UUID"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
          />
          <button
            type="button"
            disabled={loading || !user.trim()}
            onClick={() => void submit()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Credit 7 entries
          </button>
          {message ? <p className="text-xs text-primary">{message}</p> : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      </section>
    </div>
  )
}
