"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronUp,
  Loader2,
  Send,
  X,
} from "lucide-react"
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
import { ChatMessageBubble, shouldShowDayDivider } from "./chat-message-bubble"
import { UserAvatar } from "./user-avatar"

type TradeChatPanelProps = {
  otherUserId: string
  tradeId?: string
  prefillMyIds?: string[]
  prefillTheirIds?: string[]
  returnTo?: "messages"
}

export function TradeChatPanel({
  otherUserId,
  tradeId: initialTradeId,
  prefillMyIds,
  prefillTheirIds,
  returnTo,
}: TradeChatPanelProps) {
  const social = useSocial()
  const { user, getSupabase } = useAuth()
  const closePanel = returnTo === "messages" ? social.openMessages : social.close
  const other = social.getCachedProfile(otherUserId)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [trade, setTrade] = useState<Trade | null>(null)
  const [messages, setMessages] = useState<TradeMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [offerOpen, setOfferOpen] = useState(true)
  const [myCards, setMyCards] = useState<TcgCard[]>([])
  const [theirCards, setTheirCards] = useState<TcgCard[]>([])
  const [bindersLoading, setBindersLoading] = useState(true)
  const [mySelected, setMySelected] = useState<Set<string>>(() => new Set(prefillMyIds ?? []))
  const [theirSelected, setTheirSelected] = useState<Set<string>>(
    () => new Set(prefillTheirIds ?? []),
  )
  const [error, setError] = useState<string | null>(null)

  const activeTradeId = trade?.id ?? initialTradeId
  const isInitiator = trade?.initiatorId === user?.id
  const myItems = trade?.items.filter((i) => i.userId === user?.id) ?? []
  const theirItems = trade?.items.filter((i) => i.userId !== user?.id) ?? []

  const myOffer = useMemo(() => selectedCards(myCards, mySelected), [myCards, mySelected])
  const theirOffer = useMemo(() => selectedCards(theirCards, theirSelected), [theirCards, theirSelected])
  const hasOfferSelection = myOffer.length > 0 || theirOffer.length > 0

  const loadChat = useCallback(async (threadId?: string) => {
    const id = threadId ?? activeTradeId
    if (!id) return
    const res = await fetch(`/api/trades/${encodeURIComponent(id)}`, {
      credentials: "same-origin",
    })
    if (!res.ok) return
    const data = (await res.json()) as { trade?: Trade; messages?: TradeMessage[] }
    if (data.trade) setTrade(data.trade)
    if (data.messages) setMessages(data.messages)
  }, [activeTradeId])

  useEffect(() => {
    let cancelled = false
    if (!user) return

    setBindersLoading(true)
    void (async () => {
      try {
        const [mine, theirRes] = await Promise.all([
          loadBinderCards(getSupabase(), user.id),
          fetch(`/api/binder/${encodeURIComponent(otherUserId)}`, { credentials: "same-origin" }),
        ])
        if (cancelled) return
        setMyCards(mine.filter((c) => c.status === "trade"))
        if (theirRes.ok) {
          const data = (await theirRes.json()) as { trade?: TcgCard[] }
          setTheirCards((data.trade ?? []).map((c) => ({ ...c, status: "trade" as const })))
        } else {
          setTheirCards([])
        }
      } finally {
        if (!cancelled) setBindersLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, otherUserId, getSupabase])

  useEffect(() => {
    setLoading(true)
    if (activeTradeId) {
      void loadChat().finally(() => setLoading(false))
      const timer = window.setInterval(() => void loadChat(), 8000)
      return () => window.clearInterval(timer)
    }
    setLoading(false)
    return undefined
  }, [loadChat, activeTradeId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, offerOpen])

  useEffect(() => {
    if (!trade || prefillMyIds?.length || prefillTheirIds?.length) return
    setMySelected(new Set(trade.items.filter((i) => i.userId === user?.id).map((i) => i.cardId)))
    setTheirSelected(new Set(trade.items.filter((i) => i.userId !== user?.id).map((i) => i.cardId)))
  }, [trade?.id, user?.id, prefillMyIds, prefillTheirIds, trade])

  const ensureThread = async (): Promise<string | null> => {
    if (activeTradeId) return activeTradeId
    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        recipientId: otherUserId,
        message: "",
        myItems: [],
        theirItems: [],
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { trade?: Trade; error?: string }
    if (!res.ok || !data.trade) {
      setError(data.error ?? "Could not start conversation.")
      return null
    }
    setTrade(data.trade)
    await social.refreshTrades()
    return data.trade.id
  }

  const sendMessage = async () => {
    const body = text.trim()
    if (!body) return
    setSending(true)
    setError(null)
    try {
      const threadId = await ensureThread()
      if (!threadId) return
      const res = await fetch(`/api/trades/${encodeURIComponent(threadId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? "Could not send message.")
        return
      }
      setText("")
      await loadChat(threadId)
    } finally {
      setSending(false)
    }
  }

  const sendOffer = async () => {
    if (!hasOfferSelection) {
      setError("Select cards you are offering and/or cards you want from them.")
      setOfferOpen(true)
      return
    }
    setSending(true)
    setError(null)
    try {
      const give = cardsToDraft(myOffer)
      const get = cardsToDraft(theirOffer)
      const note = text.trim()
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          recipientId: otherUserId,
          message: note,
          myItems: give,
          theirItems: get,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { trade?: Trade; error?: string }
      if (!res.ok || !data.trade) {
        setError(data.error ?? "Could not send offer.")
        return
      }
      setTrade(data.trade)
      setText("")
      await social.refreshTrades()
      await loadChat(data.trade.id)
    } finally {
      setSending(false)
    }
  }

  const updateStatus = async (status: Trade["status"]) => {
    const threadId = await ensureThread()
    if (!threadId) return
    setActionId(threadId)
    try {
      const res = await fetch("/api/trades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeId: threadId, status }),
      })
      if (res.ok) {
        await social.refreshTrades()
        await loadChat()
      }
    } finally {
      setActionId(null)
    }
  }

  const title = other?.name ?? "Chat"

  const footer = (
    <div className="p-3 sm:p-4">
      {trade?.status === "pending" && (
        <div className="mb-2 flex flex-wrap gap-2">
          {!isInitiator && (
            <>
              <button
                type="button"
                disabled={actionId === activeTradeId}
                onClick={() => void updateStatus("accepted")}
                className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                <Check className="size-3" /> Accept offer
              </button>
              <button
                type="button"
                disabled={actionId === activeTradeId}
                onClick={() => void updateStatus("declined")}
                className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
              >
                <X className="size-3" /> Decline
              </button>
            </>
          )}
          {isInitiator && (
            <button
              type="button"
              disabled={actionId === activeTradeId}
              onClick={() => void updateStatus("cancelled")}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
            >
              Cancel offer
            </button>
          )}
        </div>
      )}

      {trade?.status === "accepted" && (
        <button
          type="button"
          disabled={actionId === activeTradeId}
          onClick={() => void updateStatus("completed")}
          className="mb-2 w-full rounded-xl bg-trade py-2 text-xs font-medium text-white"
        >
          Mark trade completed
        </button>
      )}

      <button
        type="button"
        onClick={() => setOfferOpen((v) => !v)}
        className="mb-2 flex w-full items-center justify-between rounded-xl border border-border bg-card/60 px-3 py-2 text-left text-xs font-medium text-foreground"
      >
        <span className="flex items-center gap-2">
          <ArrowLeftRight className="size-3.5 text-primary" />
          {offerOpen ? "Hide card picker" : "Select cards to offer / request"}
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          {hasOfferSelection ? (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
              {myOffer.length} offer · {theirOffer.length} want
            </span>
          ) : null}
          <ChevronUp className={`size-4 transition-transform ${offerOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      {offerOpen && (
        <div className="mb-3 max-h-[40vh] space-y-2 overflow-y-auto rounded-xl border border-border bg-secondary/20 p-2">
          {bindersLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <TradeCardPicker
                title="You offer"
                subtitle="From your I have list"
                cards={myCards}
                selectedIds={mySelected}
                onToggle={(c) => setMySelected((p) => toggleCardInSet(c, p))}
                variant="offer"
                emptyLabel="Add cards to I have on your binder to offer them."
              />
              <TradeCardPicker
                title="You want"
                subtitle="From their I have list"
                cards={theirCards}
                selectedIds={theirSelected}
                onToggle={(c) => setTheirSelected((p) => toggleCardInSet(c, p))}
                variant="request"
                emptyLabel="They have no cards listed for trade yet."
              />
            </>
          )}
        </div>
      )}

      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

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
          className="min-w-0 flex-1 rounded-xl border border-border bg-secondary/60 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
        />
        <button
          type="button"
          disabled={sending || !text.trim()}
          onClick={() => void sendMessage()}
          aria-label="Send message"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground disabled:opacity-40"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>

      <button
        type="button"
        disabled={sending || !hasOfferSelection}
        onClick={() => void sendOffer()}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
      >
        {sending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArrowLeftRight className="size-4" />
        )}
        Send trade offer
      </button>
    </div>
  )

  return (
    <PanelShell
      title={title}
      onClose={closePanel}
      footer={footer}
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
      {loading && !trade && !initialTradeId ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex min-h-full flex-col p-4">
          {trade && (myItems.length > 0 || theirItems.length > 0) && (
            <div className="mb-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-xs">
              <p className="font-semibold text-foreground">Current offer · {trade.status}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <OfferSummary title="You give" items={myItems} />
                <OfferSummary title="You get" items={theirItems} />
              </div>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Chat with {other?.name ?? "this trader"}
              </p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground text-pretty">
                Send a message, or pick cards below to offer and request what you want.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, index) => {
                const day = shouldShowDayDivider(messages, index)
                return (
                  <div key={msg.id}>
                    {day && (
                      <p className="my-3 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {day}
                      </p>
                    )}
                    <ChatMessageBubble msg={msg} mine={msg.senderId === user?.id} />
                  </div>
                )
              })}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
    </PanelShell>
  )
}

function OfferSummary({
  title,
  items,
}: {
  title: string
  items: { cardName: string; cardSet: string }[]
}) {
  return (
    <div>
      <p className="font-medium text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {items.map((item) => (
            <li key={`${item.cardName}-${item.cardSet}`} className="truncate text-foreground">
              {item.cardName}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
