"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, Loader2, MessageSquarePlus } from "lucide-react"
import type { Trade, TradeMessage, User } from "@/lib/trade-binder/users"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useSocial } from "./social-provider"
import { PanelShell } from "./panel-shell"
import { UserAvatar } from "./user-avatar"

function formatWhen(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function previewText(message: TradeMessage | null, trade: Trade): string {
  if (message?.body) return message.body
  if (trade.message) return trade.message
  return "Trade conversation"
}

function messageLabel(type: TradeMessage["messageType"]): string | null {
  if (type === "proposal") return "Trade proposal"
  if (type === "counter") return "Counter-offer"
  if (type === "status") return "Status update"
  return null
}

export function MessagesPanel() {
  const social = useSocial()
  const { user } = useAuth()
  const [trades, setTrades] = useState<Trade[]>(social.trades)
  const [lastMessages, setLastMessages] = useState<Record<string, TradeMessage>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setTrades(social.trades)
  }, [social.trades])

  useEffect(() => {
    setLoading(true)
    void fetch("/api/trades", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { trades?: Trade[]; lastMessages?: Record<string, TradeMessage> } | null) => {
        if (data?.trades) setTrades(data.trades)
        if (data?.lastMessages) setLastMessages(data.lastMessages)
      })
      .finally(() => setLoading(false))
  }, [])

  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      const aTime = lastMessages[a.id]?.createdAt ?? a.createdAt
      const bTime = lastMessages[b.id]?.createdAt ?? b.createdAt
      return bTime.localeCompare(aTime)
    })
  }, [trades, lastMessages])

  const activeTrades = sortedTrades.filter(
    (t) => t.status === "pending" || t.status === "accepted",
  )
  const otherTrades = sortedTrades.filter(
    (t) => t.status !== "pending" && t.status !== "accepted",
  )

  return (
    <PanelShell title="Messages" onClose={social.close}>
      <div className="p-4 sm:p-6">
        {loading && trades.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : trades.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
            <MessageSquarePlus className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No messages yet</p>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              Start a trade from a match or trader profile to open a conversation.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTrades.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Active
                </h3>
                <ul className="flex flex-col gap-2">
                  {activeTrades.map((trade) => (
                    <ConversationRow
                      key={trade.id}
                      trade={trade}
                      lastMessage={lastMessages[trade.id] ?? null}
                      userId={user?.id}
                      onOpen={() => social.openTradeChat(trade.id, "messages")}
                      getProfile={social.getCachedProfile}
                    />
                  ))}
                </ul>
              </section>
            )}

            {otherTrades.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Earlier
                </h3>
                <ul className="flex flex-col gap-2">
                  {otherTrades.map((trade) => (
                    <ConversationRow
                      key={trade.id}
                      trade={trade}
                      lastMessage={lastMessages[trade.id] ?? null}
                      userId={user?.id}
                      onOpen={() => social.openTradeChat(trade.id, "messages")}
                      getProfile={social.getCachedProfile}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </PanelShell>
  )
}

function ConversationRow({
  trade,
  lastMessage,
  userId,
  onOpen,
  getProfile,
}: {
  trade: Trade
  lastMessage: TradeMessage | null
  userId?: string
  onOpen: () => void
  getProfile: (id: string) => User | undefined
}) {
  const otherId = trade.initiatorId === userId ? trade.recipientId : trade.initiatorId
  const other = getProfile(otherId)
  const when = lastMessage?.createdAt ?? trade.createdAt
  const systemLabel = lastMessage ? messageLabel(lastMessage.messageType) : null
  const needsAction =
    trade.status === "pending" && trade.recipientId === userId && trade.initiatorId !== userId

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 rounded-xl border border-border bg-card/60 p-3 text-left transition-colors hover:border-primary/40"
      >
        {other ? (
          <UserAvatar user={other} size="md" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-muted-foreground">
            ?
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {other?.name ?? "Trader"}
            </p>
            <span className="shrink-0 text-[10px] text-muted-foreground">{formatWhen(when)}</span>
          </div>

          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {systemLabel ? (
              <span className="font-medium text-primary">{systemLabel}: </span>
            ) : null}
            {previewText(lastMessage, trade)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
              <ArrowLeftRight className="size-3" />
              {trade.status}
            </span>
            {needsAction && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                Needs reply
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  )
}
