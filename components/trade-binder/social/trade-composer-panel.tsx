"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, Loader2 } from "lucide-react"
import type { TcgCard } from "@/lib/trade-binder/cards"
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

type TradeComposerPanelProps = {
  userId: string
  prefillMyIds?: string[]
  prefillTheirIds?: string[]
}

export function TradeComposerPanel({ userId, prefillMyIds, prefillTheirIds }: TradeComposerPanelProps) {
  const social = useSocial()
  const { user, getSupabase } = useAuth()
  const profile = social.getCachedProfile(userId)

  const [myCards, setMyCards] = useState<TcgCard[]>([])
  const [theirCards, setTheirCards] = useState<TcgCard[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const [mySelected, setMySelected] = useState<Set<string>>(() => new Set(prefillMyIds ?? []))
  const [theirSelected, setTheirSelected] = useState<Set<string>>(() => new Set(prefillTheirIds ?? []))

  useEffect(() => {
    let cancelled = false
    if (!user) return

    setLoading(true)
    void (async () => {
      try {
        const [mine, theirRes] = await Promise.all([
          loadBinderCards(getSupabase(), user.id),
          fetch(`/api/binder/${encodeURIComponent(userId)}`, { credentials: "same-origin" }),
        ])

        if (cancelled) return

        setMyCards(mine.filter((c) => c.status === "trade"))

        if (theirRes.ok) {
          const data = (await theirRes.json()) as { trade?: TcgCard[] }
          setTheirCards((data.trade ?? []).map((c) => ({ ...c, status: "trade" as const })))
        } else {
          setTheirCards([])
        }
      } catch {
        if (!cancelled) setError("Could not load binders for trade.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, userId, getSupabase])

  const myOffer = useMemo(() => selectedCards(myCards, mySelected), [myCards, mySelected])
  const theirOffer = useMemo(() => selectedCards(theirCards, theirSelected), [theirCards, theirSelected])

  const submit = async () => {
    if (!user) return
    if (myOffer.length === 0 && theirOffer.length === 0) {
      setError("Select at least one card to offer or request.")
      return
    }

    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          recipientId: userId,
          message,
          myItems: cardsToDraft(myOffer),
          theirItems: cardsToDraft(theirOffer),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { trade?: { id: string }; error?: string }
      if (!res.ok || !data.trade) {
        setError(data.error ?? "Could not send trade proposal.")
        return
      }
      await social.refreshTrades()
      social.openTradeChat(data.trade.id, "messages")
    } finally {
      setSending(false)
    }
  }

  return (
    <PanelShell title="New trade" onClose={social.close}>
      <div className="space-y-4 p-4 sm:p-6">
        {profile && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3">
            <UserAvatar user={profile} size="md" />
            <div>
              <p className="text-sm font-semibold text-foreground">{profile.name}</p>
              <p className="text-[11px] text-muted-foreground">{profile.handle}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <TradeCardPicker
              title="You offer"
              subtitle="Pick from your I have list"
              cards={myCards}
              selectedIds={mySelected}
              onToggle={(card) => setMySelected((prev) => toggleCardInSet(card, prev))}
              variant="offer"
              emptyLabel="Add cards to I have on your binder first."
            />

            <TradeCardPicker
              title="You want"
              subtitle="Pick from their I have list"
              cards={theirCards}
              selectedIds={theirSelected}
              onToggle={(card) => setTheirSelected((prev) => toggleCardInSet(card, prev))}
              variant="request"
              emptyLabel="They have no cards listed for trade."
            />

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Add a message about your trade…"
              className="w-full resize-none rounded-xl border border-border bg-secondary/60 p-3 text-sm outline-none focus:border-primary/50"
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="button"
              disabled={sending}
              onClick={() => void submit()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowLeftRight className="size-4" />}
              Send trade proposal
            </button>
          </>
        )}
      </div>
    </PanelShell>
  )
}
