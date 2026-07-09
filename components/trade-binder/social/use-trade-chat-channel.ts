"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"

type TypingPayload = {
  userId: string
  name?: string
}

export function useTradeChatChannel(
  getSupabase: () => SupabaseClient,
  tradeId: string | undefined,
  userId: string | undefined,
  onNewMessage: () => void,
) {
  const onNewMessageRef = useRef(onNewMessage)
  onNewMessageRef.current = onNewMessage

  const [partnerTyping, setPartnerTyping] = useState(false)
  const typingTimeoutRef = useRef<number | null>(null)
  const lastTypingSentRef = useRef(0)
  const channelRef = useRef<ReturnType<SupabaseClient["channel"]> | null>(null)

  useEffect(() => {
    if (!tradeId || !userId) return

    const supabase = getSupabase()
    const channel = supabase.channel(`trade-chat:${tradeId}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trade_messages",
          filter: `trade_id=eq.${tradeId}`,
        },
        () => {
          onNewMessageRef.current()
        },
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        const data = payload.payload as TypingPayload
        if (data.userId === userId) return
        setPartnerTyping(true)
        if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = window.setTimeout(() => setPartnerTyping(false), 2800)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current)
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [getSupabase, tradeId, userId])

  const notifyTyping = useCallback(() => {
    if (!userId || !channelRef.current) return
    const now = Date.now()
    if (now - lastTypingSentRef.current < 1200) return
    lastTypingSentRef.current = now
    void channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId } satisfies TypingPayload,
    })
  }, [userId])

  return { partnerTyping, notifyTyping }
}
