"use client"

import Image from "next/image"
import { CheckCircle2, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MockCardEntry } from "@/lib/slab-data"

function formatPrice(value: number | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return `$${value.toFixed(2)}`
}

export function CardFoundSheet({
  card,
  onOpen,
  onDismiss,
  className,
}: {
  card: MockCardEntry
  onOpen: () => void
  onDismiss?: () => void
  className?: string
}) {
  const rawPrice = formatPrice(card.rawPrice)

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-30 animate-in slide-in-from-bottom-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] duration-300",
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-zinc-950/95 p-3 text-left shadow-2xl backdrop-blur-md"
      >
        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
          {card.imageUrl ? (
            <Image src={card.imageUrl} alt="" fill className="object-cover" unoptimized />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Card found
          </p>
          <p className="truncate text-sm font-semibold text-white">
            {card.cardName}
            {rawPrice ? ` (${rawPrice})` : ""}
          </p>
          <p className="truncate text-xs text-white/60">
            {card.setName}
            {card.cardNumber ? ` · #${card.cardNumber}` : ""}
          </p>
          <p className="mt-1 text-[11px] font-medium text-white/75">
            Tap to view details &amp; add to collection
          </p>
        </div>
        <ChevronUp className="size-5 shrink-0 text-white/50" aria-hidden="true" />
      </button>

      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-2 w-full text-center text-[11px] font-medium text-white/45 hover:text-white/70"
        >
          Scan another card
        </button>
      ) : null}
    </div>
  )
}
