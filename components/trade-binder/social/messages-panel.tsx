"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, Loader2, MessageSquarePlus } from "lucide-react"
import type { Trade, TradeMessage, User } from "@/lib/trade-binder/users"
import { isTradeAcceptedForDisplay, tradePartnerId, tradeNeedsMyAcceptance } from "@/lib/trade-binder/trades"
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
  if (message?.messageType === "image") return message.body || "Photo"
  if (message?.body) return message.body
  if (trade.message) return trade.message
  return "Trade conversation"
}

function messageLabel(type: TradeMessage["messageType"]): string | null {
  if (type === "proposal") return "Trade proposal"
  if (type === "counter") return "Updated offer"
  if (type === "status") return "Status update"
  if (type === "image") return "Photo"
  return null
}

function lastMessageForThread(
  trade: Trade,
  userId: string,
  allTrades: Trade[],
  lastMessages: Record<string, TradeMessage>,
): TradeMessage | null {
  const partnerId = tradePartnerId(trade, userId)
  let best: TradeMessage | null = null
  for (const row of allTrades) {
    if (tradePartnerId(row, userId) !== partnerId) continue
    const msg = lastMessages[row.id]
    if (!msg) continue
    if (!best || msg.createdAt > best.createdAt) best = msg
  }
  return best
}

export function MessagesPanel() {
  const social = useSocial()
  const { user } = useAuth()
  const [threads, setThreads] = useState<Trade[]>(social.trades)
  const [allTrades, setAllTrades] = useState<Trade[]>(social.trades)
  const [lastMessages, setLastMessages] = useState<Record<string, TradeMessage>>({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadThreads = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    return fetch("/api/trades", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(data.error ?? "Could not load messages")
        }
        return res.json() as Promise<{
          trades?: Trade[]
          allTrades?: Trade[]
          lastMessages?: Record<string, TradeMessage>
        }>
      })
      .then((data) => {
        if (data?.trades) setThreads(data.trades)
        if (data?.allTrades) setAllTrades(data.allTrades)
        else if (data?.trades) setAllTrades(data.trades)
        if (data?.lastMessages) setLastMessages(data.lastMessages)
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Could not load messages")
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setThreads(social.trades)
  }, [social.trades])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  const sortedThreads = useMemo(() => {
    if (!user) return threads
    return [...threads].sort((a, b) => {
      const aTime =
        lastMessageForThread(a, user.id, allTrades, lastMessages)?.createdAt ??
        a.updatedAt ??
        a.createdAt
      const bTime =
        lastMessageForThread(b, user.id, allTrades, lastMessages)?.createdAt ??
        b.updatedAt ??
        b.createdAt
      return bTime.localeCompare(aTime)
    })
  }, [threads, allTrades, lastMessages, user])

  const activeThreads = sortedThreads.filter(
    (t) => t.status === "pending" || isTradeAcceptedForDisplay(t),
  )
  const otherThreads = sortedThreads.filter(
    (t) => t.status !== "pending" && !isTradeAcceptedForDisplay(t),
  )

  return (
    <PanelShell title="Messages" onClose={social.close}>
      <div className="p-4 sm:p-6">
        {loadError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadThreads()}
              className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
            >
              Retry
            </button>
          </div>
        ) : loading && threads.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : threads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
            <MessageSquarePlus className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No messages yet</p>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              Start a trade from a match or trader profile to open a conversation.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeThreads.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Active
                </h3>
                <ul className="flex flex-col gap-2">
                  {activeThreads.map((trade) => (
                    <ConversationRow
                      key={tradePartnerId(trade, user!.id)}
                      trade={trade}
                      lastMessage={
                        user
                          ? lastMessageForThread(trade, user.id, allTrades, lastMessages)
                          : null
                      }
                      userId={user?.id}
                      onOpen={() => social.openTradeWithUser(tradePartnerId(trade, user!.id))}
                      getProfile={social.getCachedProfile}
                    />
                  ))}
                </ul>
              </section>
            )}

            {otherThreads.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Earlier
                </h3>
                <ul className="flex flex-col gap-2">
                  {otherThreads.map((trade) => (
                    <ConversationRow
                      key={tradePartnerId(trade, user!.id)}
                      trade={trade}
                      lastMessage={
                        user
                          ? lastMessageForThread(trade, user.id, allTrades, lastMessages)
                          : null
                      }
                      userId={user?.id}
                      onOpen={() => social.openTradeWithUser(tradePartnerId(trade, user!.id))}
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
  const when = lastMessage?.createdAt ?? trade.updatedAt ?? trade.createdAt
  const systemLabel = lastMessage ? messageLabel(lastMessage.messageType) : null
  const needsAction = userId ? tradeNeedsMyAcceptance(trade, userId) : false

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
