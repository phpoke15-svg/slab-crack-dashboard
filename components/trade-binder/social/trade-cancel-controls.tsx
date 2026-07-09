"use client"

import { useState } from "react"
import { Loader2, X } from "lucide-react"
import type { Trade } from "@/lib/trade-binder/users"
import {
  tradeAwaitingPartnerCancel,
  tradeNeedsMyCancelConfirmation,
  userHasRequestedCancel,
} from "@/lib/trade-binder/trade-cancellation"
import { isTradeAcceptedForDisplay } from "@/lib/trade-binder/trades"
import { cn } from "@/lib/utils"

type TradeCancelControlsProps = {
  trade: Trade
  userId: string
  partnerName: string
  className?: string
  onUpdated?: (result: { trade: Trade | null; bothCancelled: boolean }) => void
}

export function TradeCancelControls({
  trade,
  userId,
  partnerName,
  className,
  onUpdated,
}: TradeCancelControlsProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canCancel =
    trade.status === "accepted" ||
    isTradeAcceptedForDisplay(trade) ||
    (trade.status === "pending" && trade.items.length > 0)

  if (!canCancel || trade.status === "cancelled") return null

  const needsMyConfirmation = tradeNeedsMyCancelConfirmation(trade, userId)
  const awaitingPartner = tradeAwaitingPartnerCancel(trade, userId)
  const iRequested = userHasRequestedCancel(trade, userId)

  const requestCancel = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/trades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ tradeId: trade.id, status: "cancelled" }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        trade?: Trade
        bothCancelled?: boolean
      }
      if (!res.ok) {
        setError(data.error ?? "Could not update cancel request.")
        return
      }
      onUpdated?.({ trade: data.trade ?? null, bothCancelled: Boolean(data.bothCancelled) })
    } catch {
      setError("Could not update cancel request.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {needsMyConfirmation && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive text-pretty">
          {partnerName} requested to cancel. Confirm to cancel together — cards return to I have / I
          want and matching.
        </p>
      )}
      {awaitingPartner && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground text-pretty">
          You requested cancel — waiting for {partnerName} to confirm.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!iRequested && !needsMyConfirmation && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void requestCancel()}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : null}
            Request cancel
          </button>
        )}
        {needsMyConfirmation && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void requestCancel()}
            className="inline-flex items-center gap-1 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <X className="size-3" aria-hidden="true" />
            )}
            Confirm cancel
          </button>
        )}
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
