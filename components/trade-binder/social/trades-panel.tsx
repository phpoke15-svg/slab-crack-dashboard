"use client"

import { useEffect, useState } from "react"
import { ArrowLeftRight, Check, Loader2, X } from "lucide-react"
import type { Trade } from "@/lib/trade-binder/users"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useSocial } from "./social-provider"
import { PanelShell } from "./panel-shell"
import { UserAvatar } from "./user-avatar"

export function TradesPanel() {
  const social = useSocial()
  const { user } = useAuth()
  const [trades, setTrades] = useState<Trade[]>(social.trades)
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)

  useEffect(() => {
    setTrades(social.trades)
  }, [social.trades])

  useEffect(() => {
    setLoading(true)
    void social.refreshTrades().finally(() => setLoading(false))
  }, [social])

  const updateStatus = async (tradeId: string, status: Trade["status"]) => {
    setActionId(tradeId)
    try {
      const res = await fetch("/api/trades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeId, status }),
      })
      if (res.ok) await social.refreshTrades()
    } finally {
      setActionId(null)
    }
  }

  return (
    <PanelShell title="Trades" onClose={social.close}>
      <div className="p-4">
        {loading && trades.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading trades…</p>
        ) : trades.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No trade proposals yet. Find matches and send a proposal from a trader&apos;s profile.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {trades.map((trade) => {
              const isInitiator = trade.initiatorId === user?.id
              const otherId = isInitiator ? trade.recipientId : trade.initiatorId
              const other = social.getCachedProfile(otherId)
              const myItems = trade.items.filter((i) => i.userId === user?.id)
              const theirItems = trade.items.filter((i) => i.userId !== user?.id)
              const busy = actionId === trade.id

              return (
                <li key={trade.id} className="rounded-xl border border-border bg-card/60 p-3">
                  <div className="flex items-center gap-2">
                    {other && <UserAvatar user={other} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => social.openProfile(otherId)}
                        className="truncate text-sm font-medium text-foreground hover:text-primary"
                      >
                        {other?.name ?? "Trader"}
                      </button>
                      <p className="text-[10px] capitalize text-muted-foreground">{trade.status}</p>
                    </div>
                    <ArrowLeftRight className="size-4 shrink-0 text-muted-foreground" />
                  </div>

                  {trade.message && (
                    <p className="mt-2 text-sm text-muted-foreground text-pretty">{trade.message}</p>
                  )}

                  <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                    <TradeItemList title="You give" items={myItems} />
                    <TradeItemList title="You get" items={theirItems} />
                  </div>

                  {trade.status === "pending" && !isInitiator && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateStatus(trade.id, "accepted")}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                      >
                        {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateStatus(trade.id, "declined")}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium"
                      >
                        <X className="size-3" /> Decline
                      </button>
                    </div>
                  )}

                  {trade.status === "accepted" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => updateStatus(trade.id, "completed")}
                      className="mt-3 w-full rounded-lg bg-trade px-3 py-2 text-xs font-medium text-white"
                    >
                      Mark completed
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </PanelShell>
  )
}

function TradeItemList({
  title,
  items,
}: {
  title: string
  items: { cardName: string; cardSet: string }[]
}) {
  return (
    <div className="rounded-lg bg-secondary/40 p-2">
      <p className="mb-1 font-medium text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={`${item.cardName}-${item.cardSet}`} className="truncate">
              {item.cardName}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
