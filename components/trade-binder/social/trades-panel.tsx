"use client"

import { useEffect, useState } from "react"
import { ArrowLeftRight } from "lucide-react"
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

  useEffect(() => {
    setTrades(social.trades)
  }, [social.trades])

  useEffect(() => {
    setLoading(true)
    void social.refreshTrades().finally(() => setLoading(false))
  }, [social])

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

              return (
                <li key={trade.id}>
                  <button
                    type="button"
                    onClick={() => social.openTradeWithUser(otherId)}
                    className="w-full rounded-xl border border-border bg-card/60 p-3 text-left transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center gap-2">
                      {other && <UserAvatar user={other} size="sm" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {other?.name ?? "Trader"}
                        </p>
                        <p className="text-[10px] capitalize text-muted-foreground">
                          {trade.status} · Open chat
                        </p>
                      </div>
                      <ArrowLeftRight className="size-4 shrink-0 text-muted-foreground" />
                    </div>

                    <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                      <TradeItemList title="You give" items={myItems} />
                      <TradeItemList title="You get" items={theirItems} />
                    </div>
                  </button>
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
