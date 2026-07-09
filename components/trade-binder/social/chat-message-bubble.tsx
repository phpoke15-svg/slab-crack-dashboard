"use client"

import Image from "next/image"
import type { OfferPayload } from "@/lib/trade-binder/offer-message"
import { parseOfferMessage } from "@/lib/trade-binder/offer-message"
import type { TradeMessage } from "@/lib/trade-binder/users"

function OfferCardStrip({
  label,
  cards,
  tone,
}: {
  label: string
  cards: OfferPayload["give"]
  tone: "give" | "get"
}) {
  if (cards.length === 0) return null
  return (
    <div className="mt-2">
      <p
        className={`text-[10px] font-semibold uppercase tracking-wide ${
          tone === "give" ? "text-trade" : "text-wishlist"
        }`}
      >
        {label}
      </p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {cards.map((card) => (
          <li
            key={card.cardId}
            className="flex max-w-[8.5rem] items-center gap-1.5 rounded-lg bg-background/40 px-1.5 py-1"
          >
            <div className="relative size-8 shrink-0 overflow-hidden rounded-md bg-secondary">
              <Image
                src={card.cardImage || "/placeholder.svg"}
                alt=""
                fill
                className="object-cover"
                sizes="32px"
              />
            </div>
            <span className="min-w-0 truncate text-[11px] font-medium">{card.cardName}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ChatMessageBubble({
  msg,
  mine,
}: {
  msg: TradeMessage
  mine: boolean
}) {
  const offer = msg.messageType === "text" ? null : parseOfferMessage(msg.body)
  const label =
    msg.messageType === "proposal"
      ? "Trade offer"
      : msg.messageType === "counter"
        ? "Updated offer"
        : msg.messageType === "status"
          ? "Update"
          : null

  const time = new Date(msg.createdAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[min(100%,20rem)] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
        }`}
      >
        {label && (
          <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${mine ? "opacity-80" : "text-primary"}`}>
            {label}
          </p>
        )}

        {offer ? (
          <>
            {offer.note ? <p className="text-pretty">{offer.note}</p> : null}
            <OfferCardStrip label={mine ? "I offer" : "They offer"} cards={offer.give} tone="give" />
            <OfferCardStrip label={mine ? "I want" : "They want"} cards={offer.get} tone="get" />
          </>
        ) : (
          <p className="text-pretty whitespace-pre-wrap">{msg.body}</p>
        )}

        <time className={`mt-1 block text-[9px] ${mine ? "opacity-70" : "text-muted-foreground"}`}>
          {time}
        </time>
      </div>
    </div>
  )
}

export function formatChatDay(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) return "Today"
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return "Yesterday"
  }
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

export function shouldShowDayDivider(messages: TradeMessage[], index: number): string | null {
  if (index === 0) return formatChatDay(messages[0].createdAt)
  const prev = new Date(messages[index - 1].createdAt)
  const curr = new Date(messages[index].createdAt)
  if (
    prev.getFullYear() === curr.getFullYear() &&
    prev.getMonth() === curr.getMonth() &&
    prev.getDate() === curr.getDate()
  ) {
    return null
  }
  return formatChatDay(messages[index].createdAt)
}
