"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, Check, ChevronLeft, Loader2, Send, X } from "lucide-react"
import type { TcgCard } from "@/lib/trade-binder/cards"
import type { Trade, TradeMessage } from "@/lib/trade-binder/users"
import { loadBinderCards } from "@/lib/trade-binder/binder"
import { useAuth } from "@/components/trade-binder/auth/auth-provider"
import { useSocial } from "./social-provider"
import { PanelShell } from "./panel-shell"
import {
  TradeCardPicker,
  cardsToDraft,
  selectedCards,
  toggleCardInSet,
} from "./trade-card-picker"
import { UserAvatar } from "./user-avatar"

export function TradeChatPanel({
  tradeId,
  returnTo,
}: {
  tradeId: string
  returnTo?: "messages"
}) {
  const social = useSocial()
  const { user, getSupabase } = useAuth()
  const closePanel = returnTo === "messages" ? social.openMessages : social.close

  const [trade, setTrade] = useState<Trade | null>(null)
  const [messages, setMessages] = useState<TradeMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [counterOpen, setCounterOpen] = useState(false)
  const [myCards, setMyCards] = useState<TcgCard[]>([])
  const [theirCards, setTheirCards] = useState<TcgCard[]>([])
  const [mySelected, setMySelected] = useState<Set<string>>(new Set())
  const [theirSelected, setTheirSelected] = useState<Set<string>>(new Set())
  const [counterNote, setCounterNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  const loadChat = useCallback(async () => {
    const res = await fetch(`/api/trades/${encodeURIComponent(tradeId)}`, {
      credentials: "same-origin",
    })
    if (!res.ok) return
    const data = (await res.json()) as { trade?: Trade; messages?: TradeMessage[] }
    if (data.trade) setTrade(data.trade)
    if (data.messages) setMessages(data.messages)
  }, [tradeId])

  useEffect(() => {
    setLoading(true)
    void loadChat().finally(() => setLoading(false))
    const timer = window.setInterval(() => void loadChat(), 12000)
    return () => window.clearInterval(timer)
  }, [loadChat])

  const otherId = useMemo(() => {
    if (!trade || !user) return null
    return trade.initiatorId === user.id ? trade.recipientId : trade.initiatorId
  }, [trade, user])

  const other = otherId ? social.getCachedProfile(otherId) : undefined
  const isInitiator = trade?.initiatorId === user?.id

  const myItems = trade?.items.filter((i) => i.userId === user?.id) ?? []
  const theirItems = trade?.items.filter((i) => i.userId !== user?.id) ?? []

  useEffect(() => {
    if (!counterOpen || !user || !otherId || !trade) return
    let cancelled = false
    void (async () => {
      const [mine, theirRes] = await Promise.all([
        loadBinderCards(getSupabase(), user.id),
        fetch(`/api/binder/${encodeURIComponent(otherId)}`, { credentials: "same-origin" }),
      ])
      if (cancelled) return
      setMyCards(mine.filter((c) => c.status === "trade"))
      if (theirRes.ok) {
        const data = (await theirRes.json()) as { trade?: TcgCard[] }
        setTheirCards((data.trade ?? []).map((c) => ({ ...c, status: "trade" as const })))
      }
      setMySelected(new Set(trade.items.filter((i) => i.userId === user.id).map((i) => i.cardId)))
      setTheirSelected(new Set(trade.items.filter((i) => i.userId !== user.id).map((i) => i.cardId)))
    })()
    return () => {
      cancelled = true
    }
  }, [counterOpen, user?.id, otherId, trade?.id, getSupabase])

  const sendMessage = async () => {
    const body = text.trim()
    if (!body) return
    setSending(true)
    try {
      const res = await fetch(`/api/trades/${encodeURIComponent(tradeId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ body }),
      })
      if (res.ok) {
        setText("")
        await loadChat()
      }
    } finally {
      setSending(false)
    }
  }

  const updateStatus = async (status: Trade["status"]) => {
    setActionId(tradeId)
    try {
      const res = await fetch("/api/trades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeId, status }),
      })
      if (res.ok) {
        await social.refreshTrades()
        await loadChat()
      }
    } finally {
      setActionId(null)
    }
  }

  const submitCounter = async () => {
    const myOffer = selectedCards(myCards, mySelected)
    const theirOffer = selectedCards(theirCards, theirSelected)
    if (myOffer.length === 0 && theirOffer.length === 0) {
      setError("Select at least one card.")
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/trades/${encodeURIComponent(tradeId)}/counter`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          message: counterNote,
          myItems: cardsToDraft(myOffer),
          theirItems: cardsToDraft(theirOffer),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { trade?: Trade; error?: string }
      if (!res.ok) {
        setError(data.error ?? "Could not update offer.")
        return
      }
      if (data.trade) setTrade(data.trade)
      setCounterOpen(false)
      await loadChat()
      await social.refreshTrades()
    } finally {
      setSending(false)
    }
  }

  if (loading && !trade) {
    return (
      <PanelShell title="Trade chat" onClose={closePanel}>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </PanelShell>
    )
  }

  if (!trade) {
    return (
      <PanelShell title="Trade chat" onClose={closePanel}>
        <p className="p-6 text-sm text-muted-foreground">Trade not found.</p>
      </PanelShell>
    )
  }

  return (
    <PanelShell
      title="Trade chat"
      onClose={closePanel}
      headerAccessory={
        <>
          {returnTo === "messages" && (
            <button
              type="button"
              onClick={social.openMessages}
              aria-label="Back to messages"
              className="flex size-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          {other ? (
            <button
              type="button"
              onClick={() => social.openProfile(other.id)}
              className="flex items-center gap-2 rounded-lg border border-border px-2 py-1 text-xs hover:border-primary/40"
            >
              <UserAvatar user={other} size="sm" />
              <span className="max-w-[8rem] truncate">{other.name}</span>
            </button>
          ) : null}
        </>
      }
    >
      <div className="flex min-h-full flex-col">
        <div className="border-b border-border p-4">
          <p className="text-xs capitalize text-muted-foreground">Status: {trade.status}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <CardSummary title="You give" items={myItems} />
            <CardSummary title="You get" items={theirItems} />
          </div>

          {trade.status === "pending" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {!isInitiator && (
                <>
                  <button
                    type="button"
                    disabled={actionId === tradeId}
                    onClick={() => void updateStatus("accepted")}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  >
                    <Check className="size-3" /> Accept
                  </button>
                  <button
                    type="button"
                    disabled={actionId === tradeId}
                    onClick={() => void updateStatus("declined")}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs"
                  >
                    <X className="size-3" /> Decline
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setCounterOpen((v) => !v)}
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs"
              >
                <ArrowLeftRight className="size-3" /> {counterOpen ? "Hide editor" : "Edit offer"}
              </button>
              <button
                type="button"
                disabled={actionId === tradeId}
                onClick={() => void updateStatus("cancelled")}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          )}

          {trade.status === "accepted" && (
            <button
              type="button"
              disabled={actionId === tradeId}
              onClick={() => void updateStatus("completed")}
              className="mt-3 w-full rounded-lg bg-trade px-3 py-2 text-xs font-medium text-white"
            >
              Mark completed
            </button>
          )}
        </div>

        {counterOpen && trade.status === "pending" && (
          <div className="space-y-3 border-b border-border bg-secondary/20 p-4">
            <TradeCardPicker
              title="You offer"
              cards={myCards}
              selectedIds={mySelected}
              onToggle={(c) => setMySelected((p) => toggleCardInSet(c, p))}
              variant="offer"
            />
            <TradeCardPicker
              title="You want"
              cards={theirCards}
              selectedIds={theirSelected}
              onToggle={(c) => setTheirSelected((p) => toggleCardInSet(c, p))}
              variant="request"
            />
            <textarea
              value={counterNote}
              onChange={(e) => setCounterNote(e.target.value)}
              rows={2}
              placeholder="Note about your updated offer…"
              className="w-full resize-none rounded-xl border border-border bg-background p-2 text-sm"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="button"
              disabled={sending}
              onClick={() => void submitCounter()}
              className="w-full rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground"
            >
              Update offer
            </button>
          </div>
        )}

        <div className="flex-1 space-y-2 p-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet. Say hi!</p>
          ) : (
            messages.map((msg) => {
              const mine = msg.senderId === user?.id
              return (
                <div
                  key={msg.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                    }`}
                  >
                    {msg.messageType !== "text" && (
                      <p className="mb-0.5 text-[10px] uppercase opacity-70">{msg.messageType}</p>
                    )}
                    <p className="text-pretty">{msg.body}</p>
                    <time className="mt-1 block text-[9px] opacity-60">
                      {new Date(msg.createdAt).toLocaleString()}
                    </time>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="sticky bottom-0 border-t border-border bg-background p-4">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void sendMessage()
                }
              }}
              placeholder="Type a message…"
              className="min-w-0 flex-1 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
            <button
              type="button"
              disabled={sending || !text.trim()}
              onClick={() => void sendMessage()}
              className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </PanelShell>
  )
}

function CardSummary({
  title,
  items,
}: {
  title: string
  items: { cardName: string; cardSet: string }[]
}) {
  return (
    <div className="rounded-lg bg-secondary/40 p-2 text-xs">
      <p className="font-medium text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={`${item.cardName}-${item.cardSet}`} className="truncate">
              {item.cardName}
              {item.cardSet ? <span className="text-muted-foreground"> · {item.cardSet}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
