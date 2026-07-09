"use client"

import { useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"
import type { Trade } from "@/lib/trade-binder/users"
import {
  SHIPPING_CARRIERS,
  myOutgoingShipping,
  partnerOutgoingShipping,
} from "@/lib/trade-binder/trade-shipping"
import {
  TRADE_FULFILLMENT_LABELS,
  isFulfillmentItemChecked,
} from "@/lib/trade-binder/trade-fulfillment"

type TradeShippingFieldsProps = {
  trade: Trade
  userId: string
  partnerName: string
  compact?: boolean
  onSaved?: (trade: Trade) => void
}

export function TradeShippingFields({
  trade,
  userId,
  partnerName,
  compact = false,
  onSaved,
}: TradeShippingFieldsProps) {
  const mine = myOutgoingShipping(trade, userId)
  const theirs = partnerOutgoingShipping(trade, userId)
  const [tracking, setTracking] = useState(mine.tracking)
  const [carrier, setCarrier] = useState(mine.carrier || "USPS")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setTracking(mine.tracking)
    setCarrier(mine.carrier || "USPS")
  }, [mine.tracking, mine.carrier, trade.id])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/trades/${encodeURIComponent(trade.id)}/shipping`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ tracking, carrier }),
      })
      const data = (await res.json().catch(() => ({}))) as { trade?: Trade; error?: string }
      if (!res.ok || !data.trade) {
        setError(data.error ?? "Could not save tracking.")
        return
      }
      setSaved(true)
      onSaved?.(data.trade)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={compact ? "space-y-2" : "mt-3 space-y-3 border-t border-border/60 pt-3"}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Your shipment
        </p>
        <div className={`mt-2 grid gap-2 ${compact ? "" : "sm:grid-cols-[7rem_1fr]"}`}>
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/50"
          >
            {SHIPPING_CARRIERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="Tracking number"
            className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/50"
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            Save tracking
          </button>
          {saved && <span className="text-xs text-trade">Saved</span>}
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/50 px-3 py-2 text-xs">
        <p className="font-medium text-muted-foreground">{partnerName}&apos;s tracking</p>
        {theirs.tracking ? (
          <p className="mt-1 text-foreground">
            {theirs.carrier ? `${theirs.carrier} · ` : ""}
            <span className="font-mono">{theirs.tracking}</span>
          </p>
        ) : (
          <p className="mt-1 text-muted-foreground">Not added yet</p>
        )}
      </div>
    </div>
  )
}

export function FulfillmentStatusPills({ trade }: { trade: Trade }) {
  const items = [
    "addresses_exchanged",
    "tracking_shared",
    "cards_received",
  ] as const

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const done = isFulfillmentItemChecked(trade.fulfillment, item)
        return (
          <span
            key={item}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              done
                ? "bg-trade/15 text-trade"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {TRADE_FULFILLMENT_LABELS[item]}
            {done ? " ✓" : ""}
          </span>
        )
      })}
    </div>
  )
}
