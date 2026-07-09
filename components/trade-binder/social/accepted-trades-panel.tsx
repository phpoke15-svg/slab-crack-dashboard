"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, MessageSquare, Package } from "lucide-react"
import type { Trade } from "@/lib/trade-binder/users"
import { isTradeAcceptedForDisplay, tradePartnerId } from "@/lib/trade-binder/trades"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useSocial } from "./social-provider"
import { PanelShell } from "./panel-shell"
import { UserAvatar } from "./user-avatar"
import { FulfillmentStatusPills, TradeShippingFields } from "./trade-shipping-fields"

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function AcceptedTradesPanel() {
  const social = useSocial()
  const { user } = useAuth()
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadAccepted = () => {
    setLoading(true)
    setLoadError(null)
    void fetch("/api/trades", { credentials: "same-origin" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          allTrades?: Trade[]
          trades?: Trade[]
          error?: string
        }
        if (!res.ok) {
          setLoadError(data.error ?? "Could not load accepted trades.")
          setTrades([])
          return
        }
        const rows = data.allTrades ?? data.trades ?? social.allTrades
        setTrades(rows.filter(isTradeAcceptedForDisplay))
      })
      .catch(() => {
        setLoadError("Could not load accepted trades.")
        setTrades([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAccepted()
  }, [])

  const sorted = useMemo(
    () =>
      [...trades].sort((a, b) =>
        (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt),
      ),
    [trades],
  )

  const onTradeUpdated = (updated: Trade) => {
    setTrades((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    void social.refreshTrades()
    loadAccepted()
  }

  return (
    <PanelShell title="Accepted trades" onClose={social.close}>
      <div className="p-4 sm:p-6">
        <p className="mb-4 text-sm text-muted-foreground text-pretty">
          Trades both parties have agreed to. Add your mailing address and tracking number, or
          coordinate in chat.
        </p>

        {loadError ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-6 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
            <button
              type="button"
              onClick={loadAccepted}
              className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
            >
              Retry
            </button>
          </div>
        ) : loading && sorted.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
            <Package className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No accepted trades</p>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              When you and another trader both accept an offer, it will show up here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {sorted.map((trade) => {
              if (!user) return null
              const partnerId = tradePartnerId(trade, user.id)
              const partner = social.getCachedProfile(partnerId)
              const myItems = trade.items.filter((i) => i.userId === user.id)
              const theirItems = trade.items.filter((i) => i.userId !== user.id)

              return (
                <li
                  key={trade.id}
                  className="rounded-xl border border-border bg-card/60 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {partner ? (
                        <UserAvatar user={partner} size="md" />
                      ) : (
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-muted-foreground">
                          ?
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {partner?.name ?? "Trader"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Accepted {formatWhen(trade.updatedAt || trade.createdAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        social.openTradeChat(partnerId, {
                          tradeId: trade.id,
                          returnTo: "accepted-trades",
                        })
                      }
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary/40"
                    >
                      <MessageSquare className="size-3.5" />
                      Chat
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <TradeItemBlock title="You send" items={myItems} />
                    <TradeItemBlock title="You receive" items={theirItems} />
                  </div>

                  <div className="mt-3">
                    <FulfillmentStatusPills trade={trade} />
                  </div>

                  <TradeShippingFields
                    trade={trade}
                    userId={user.id}
                    partnerName={partner?.name ?? "Trader"}
                    onSaved={onTradeUpdated}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </PanelShell>
  )
}

function TradeItemBlock({
  title,
  items,
}: {
  title: string
  items: { cardName: string; cardSet: string }[]
}) {
  return (
    <div className="rounded-lg bg-secondary/40 p-2.5 text-xs">
      <p className="mb-1 font-medium text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={`${item.cardName}-${item.cardSet}`} className="truncate text-foreground">
              {item.cardName}
              {item.cardSet ? ` · ${item.cardSet}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
