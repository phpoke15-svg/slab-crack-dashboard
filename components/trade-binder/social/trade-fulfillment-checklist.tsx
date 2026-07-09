"use client"

import { AlertTriangle, Check, Loader2 } from "lucide-react"
import type { Trade, TradeFulfillmentItem } from "@/lib/trade-binder/users"
import {
  TRADE_FULFILLMENT_LABELS,
  isFulfillmentItemChecked,
} from "@/lib/trade-binder/trade-fulfillment"

const ITEMS: TradeFulfillmentItem[] = [
  "addresses_exchanged",
  "tracking_shared",
  "cards_received",
]

type TradeFulfillmentChecklistProps = {
  trade: Trade
  busyItem: TradeFulfillmentItem | null
  onToggle: (item: TradeFulfillmentItem, checked: boolean) => void
}

export function TradeFulfillmentChecklist({
  trade,
  busyItem,
  onToggle,
}: TradeFulfillmentChecklistProps) {
  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold text-foreground">Ship this trade yourselves</p>
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
            CollecTools does not handle payment or shipping. Use chat to exchange addresses and
            tracking. Failing to ship cards or backing out of a trade you agreed to may result in a{" "}
            <span className="font-medium text-foreground">permanent ban and block</span> from the
            platform.
          </p>
        </div>
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Fulfillment checklist
      </p>
      <ul className="mt-2 space-y-2">
        {ITEMS.map((item) => {
          const checked = isFulfillmentItemChecked(trade.fulfillment, item)
          const busy = busyItem === item
          return (
            <li key={item}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onToggle(item, !checked)}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/40 disabled:opacity-60"
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${
                    checked
                      ? "border-trade bg-trade text-white"
                      : "border-border bg-secondary/50 text-transparent"
                  }`}
                  aria-hidden
                >
                  {busy ? (
                    <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  ) : (
                    <Check className="size-3" />
                  )}
                </span>
                <span className={checked ? "text-foreground" : "text-muted-foreground"}>
                  {TRADE_FULFILLMENT_LABELS[item]}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
