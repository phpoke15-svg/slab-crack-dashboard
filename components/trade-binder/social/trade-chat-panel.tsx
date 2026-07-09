"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeftRight,
  Camera,
  Check,
  ChevronLeft,
  ChevronUp,
  Loader2,
  Send,
  X,
} from "lucide-react"
import type { TcgCard } from "@/lib/trade-binder/cards"
import type { Trade, TradeMessage } from "@/lib/trade-binder/users"
import {
  partnerHasAcceptedTrade,
  tradeHasActiveOffer,
  tradeNeedsMyAcceptance,
  userHasAcceptedTrade,
} from "@/lib/trade-binder/trades"
import { isMessageReadByPartner } from "@/lib/trade-binder/chat-reads"
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
import {
  ChatMessageBubble,
  shouldGroupWithPrev,
  shouldShowDayDivider,
} from "./chat-message-bubble"
import { PhotoPreviewModal } from "./photo-preview-modal"
import { useTradeChatChannel } from "./use-trade-chat-channel"
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [trade, setTrade] = useState<Trade | null>(null)
  const [messages, setMessages] = useState<TradeMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [offerOpen, setOfferOpen] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [myCards, setMyCards] = useState<TcgCard[]>([])
  const [theirCards, setTheirCards] = useState<TcgCard[]>([])
  const [bindersLoading, setBindersLoading] = useState(true)
  const [mySelected, setMySelected] = useState<Set<string>>(() => new Set(prefillMyIds ?? []))
  const [theirSelected, setTheirSelected] = useState<Set<string>>(
    () => new Set(prefillTheirIds ?? []),
  )
  const [error, setError] = useState<string | null>(null)
  const [partnerLastReadAt, setPartnerLastReadAt] = useState<string | null>(null)
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [photoCaption, setPhotoCaption] = useState("")

  const activeTradeId = trade?.id ?? initialTradeId
  const isInitiator = trade?.initiatorId === user?.id
  const hasActiveOffer = trade ? tradeHasActiveOffer(trade) : false
  const iAccepted = trade && user ? userHasAcceptedTrade(trade, user.id) : false
  const partnerAccepted = trade && user ? partnerHasAcceptedTrade(trade, user.id) : false
  const needsMyAcceptance = trade && user ? tradeNeedsMyAcceptance(trade, user.id) : false
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
    const data = (await res.json()) as {
      trade?: Trade
      messages?: TradeMessage[]
      readState?: { partnerLastReadAt: string | null }
    }
    if (data.trade) setTrade(data.trade)
    if (data.messages) {
      setMessages((prev) => {
        const pending = prev.filter((m) => m.id.startsWith("temp-"))
        const server = data.messages!
        if (pending.length === 0) return server

        // Temp ids never appear on the server — match optimistic rows by sender/body/type.
        const stillPending = pending.filter(
          (p) =>
            !server.some(
              (m) =>
                m.senderId === p.senderId &&
                m.body === p.body &&
                m.messageType === p.messageType,
            ),
        )
        return [...server, ...stillPending]
      })
    }
    if (data.readState) setPartnerLastReadAt(data.readState.partnerLastReadAt)
    void fetch(`/api/trades/${encodeURIComponent(id)}/read`, {
      method: "POST",
      credentials: "same-origin",
    })
  }, [activeTradeId])

  const loadChatRef = useRef(loadChat)
  loadChatRef.current = loadChat

  const { partnerTyping, notifyTyping } = useTradeChatChannel(
    getSupabase,
    activeTradeId,
    user?.id,
    () => {
      void loadChatRef.current()
    },
  )

  const lastMyMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.senderId === user?.id && !msg.id.startsWith("temp-")) return msg.id
    }
    return null
  }, [messages, user?.id])

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
      const timer = window.setInterval(() => void loadChat(), 30000)
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
    if (!body || !user) return
    setSending(true)
    setError(null)
    const tempId = `temp-${Date.now()}`
    const optimistic: TradeMessage = {
      id: tempId,
      tradeId: activeTradeId ?? "",
      senderId: user.id,
      body,
      messageType: "text",
      imageUrl: "",
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    const savedText = text
    setText("")
    try {
      const threadId = await ensureThread()
      if (!threadId) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setText(savedText)
        return
      }
      const res = await fetch(`/api/trades/${encodeURIComponent(threadId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? "Could not send message.")
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setText(savedText)
        return
      }
      const data = (await res.json()) as { message?: TradeMessage }
      if (data.message) {
        setMessages((prev) => {
          const without = prev.filter((m) => m.id !== tempId)
          if (without.some((m) => m.id === data.message!.id)) return without
          return [...without, data.message!]
        })
      } else {
        await loadChat(threadId)
      }
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

  const sendPhoto = async (file: File, caption: string) => {
    setUploadingPhoto(true)
    setError(null)
    try {
      const threadId = await ensureThread()
      if (!threadId) return

      const form = new FormData()
      form.append("file", file)
      if (caption.trim()) form.append("caption", caption.trim())

      const res = await fetch(`/api/trades/${encodeURIComponent(threadId)}/images`, {
        method: "POST",
        credentials: "same-origin",
        body: form,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Could not upload photo.")
        return
      }
      setPendingPhoto(null)
      setPhotoCaption("")
      await loadChat(threadId)
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
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
      {trade?.status === "pending" && hasActiveOffer && (
        <div className="mb-2 space-y-2">
          {iAccepted && !partnerAccepted && (
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
              You accepted — waiting for {other?.name ?? "them"} to accept.
            </p>
          )}
          {partnerAccepted && !iAccepted && (
            <p className="rounded-lg bg-trade/10 px-3 py-2 text-xs text-trade">
              {other?.name ?? "They"} accepted — tap Accept to confirm the trade.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {needsMyAcceptance && (
              <button
                type="button"
                disabled={actionId === activeTradeId}
                onClick={() => void updateStatus("accepted")}
                className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                <Check className="size-3" /> Accept offer
              </button>
            )}
            {hasActiveOffer && (needsMyAcceptance || (iAccepted && !partnerAccepted)) && (
              <button
                type="button"
                disabled={actionId === activeTradeId}
                onClick={() => void updateStatus("declined")}
                className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
              >
                <X className="size-3" /> Decline
              </button>
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

      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            setPhotoCaption(text)
            setPendingPhoto(file)
          }
        }}
      />

      <div className="flex gap-2">
        <button
          type="button"
          disabled={uploadingPhoto || sending}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Send card photo"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground disabled:opacity-40"
        >
          {uploadingPhoto ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
        </button>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            notifyTyping()
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void sendMessage()
            }
          }}
          placeholder="Type a message…"
          className="min-w-0 flex-1 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
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
    <>
      {pendingPhoto && (
        <PhotoPreviewModal
          file={pendingPhoto}
          caption={photoCaption}
          onCaptionChange={setPhotoCaption}
          onCancel={() => {
            setPendingPhoto(null)
            setPhotoCaption("")
          }}
          onSend={() => void sendPhoto(pendingPhoto, photoCaption)}
          sending={uploadingPhoto}
        />
      )}

      {offerOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-3xl border-t border-border bg-background p-3 shadow-2xl sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Build trade offer</p>
            <button
              type="button"
              onClick={() => setOfferOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Done
            </button>
          </div>
          <div className="max-h-[45vh] space-y-2 overflow-y-auto">
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
        </div>
      )}

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
          {trade && hasActiveOffer && (myItems.length > 0 || theirItems.length > 0) && (
            <div className="mb-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-xs">
              <p className="font-semibold text-foreground">
                Current offer · {trade.status}
                {trade.status === "pending" && iAccepted && !partnerAccepted
                  ? " · you accepted"
                  : ""}
                {trade.status === "pending" && partnerAccepted && !iAccepted
                  ? " · they accepted"
                  : ""}
              </p>
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
                Send messages and card photos, or tap the camera to share condition shots.
              </p>
            </div>
          ) : (
            <div className="space-y-1 pb-2">
              {messages.map((msg, index) => {
                const day = shouldShowDayDivider(messages, index)
                const mine = msg.senderId === user?.id
                const compact = shouldGroupWithPrev(messages, index)
                const isLastMine = msg.id === lastMyMessageId
                const readLabel =
                  mine && isLastMine && !msg.id.startsWith("temp-")
                    ? isMessageReadByPartner(msg.createdAt, partnerLastReadAt)
                      ? "Read"
                      : "Sent"
                    : null
                return (
                  <div key={msg.id}>
                    {day && (
                      <p className="my-3 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {day}
                      </p>
                    )}
                    <ChatMessageBubble
                      msg={msg}
                      mine={mine}
                      compact={compact}
                      readLabel={readLabel}
                    />
                  </div>
                )
              })}
              {partnerTyping && (
                <p className="text-xs text-muted-foreground animate-pulse">
                  {other?.name ?? "Trader"} is typing…
                </p>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
    </PanelShell>
    </>
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
