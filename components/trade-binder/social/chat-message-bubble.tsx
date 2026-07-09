"use client"

import { useState } from "react"
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

function ImageBubbleContent({ msg, mine }: { msg: TradeMessage; mine: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const showCaption =
    msg.body && msg.body !== "Shared a card photo." && msg.body.trim().length > 0

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="block overflow-hidden rounded-xl"
      >
        <div className="relative aspect-[3/4] w-44 max-w-full sm:w-52">
          <Image
            src={msg.imageUrl || "/placeholder.svg"}
            alt="Card condition photo"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 176px, 208px"
            unoptimized
          />
        </div>
      </button>
      {showCaption ? (
        <p className={`mt-2 text-pretty whitespace-pre-wrap ${mine ? "" : "text-foreground"}`}>
          {msg.body}
        </p>
      ) : null}

      {expanded && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setExpanded(false)}
          role="presentation"
        >
          <div className="relative max-h-full max-w-lg">
            <img
              src={msg.imageUrl}
              alt="Card condition photo enlarged"
              className="max-h-[85vh] w-auto max-w-full rounded-lg object-contain"
            />
            {showCaption && (
              <p className="mt-3 text-center text-sm text-white/90">{msg.body}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export function ChatMessageBubble({
  msg,
  mine,
  compact = false,
  readLabel,
}: {
  msg: TradeMessage
  mine: boolean
  compact?: boolean
  readLabel?: string | null
}) {
  const offer =
    msg.messageType === "proposal" || msg.messageType === "counter"
      ? parseOfferMessage(msg.body)
      : null
  const label =
    msg.messageType === "proposal"
      ? "Trade offer"
      : msg.messageType === "counter"
        ? "Updated offer"
        : msg.messageType === "status"
          ? "Update"
          : msg.messageType === "image"
            ? "Photo"
            : null

  const time = new Date(msg.createdAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })

  const isImage = msg.messageType === "image" && msg.imageUrl

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${compact ? "mt-0.5" : "mt-0"}`}>
      <div
        className={`max-w-[min(100%,22rem)] text-sm shadow-sm ${
          compact ? "rounded-2xl rounded-tr-md px-3 py-1.5" : "rounded-2xl px-3 py-2"
        } ${
          isImage
            ? mine
              ? "bg-primary/90 text-primary-foreground"
              : "bg-secondary text-foreground"
            : mine
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground"
        }`}
      >
        {!compact && label && (
          <p
            className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${
              mine && !isImage ? "opacity-80" : isImage ? "opacity-80" : "text-primary"
            }`}
          >
            {label}
          </p>
        )}

        {isImage ? (
          <ImageBubbleContent msg={msg} mine={mine} />
        ) : offer ? (
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
          {mine && readLabel ? (
            <span className="ml-1.5 font-medium opacity-90">· {readLabel}</span>
          ) : null}
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

export function shouldGroupWithNext(messages: TradeMessage[], index: number): boolean {
  const current = messages[index]
  const next = messages[index + 1]
  if (!next) return false
  if (current.senderId !== next.senderId) return false
  const gap = new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime()
  return gap < 3 * 60 * 1000
}

export function shouldGroupWithPrev(messages: TradeMessage[], index: number): boolean {
  if (index === 0) return false
  return shouldGroupWithNext(messages, index - 1)
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
