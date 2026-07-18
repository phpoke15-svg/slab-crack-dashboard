"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { CheckCircle2, Loader2, Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { getGradeQuotes, type MockCardEntry } from "@/lib/slab-data"

export type CardVariant = "normal" | "holo" | "reverse"

function formatPrice(value: number | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—"
  return `$${value.toFixed(2)}`
}

function gradePrice(card: MockCardEntry, grade: number): number | undefined {
  const quote = getGradeQuotes(card).find((q) => q.grade === grade)
  return quote?.slabPrice && quote.slabPrice > 0 ? quote.slabPrice : undefined
}

export function CardFoundSheet({
  card,
  onAddToPortfolio,
  onDismiss,
  adding = false,
  className,
}: {
  card: MockCardEntry
  onAddToPortfolio: (opts: { quantity: number; variant: CardVariant }) => void | Promise<void>
  onDismiss: () => void
  adding?: boolean
  className?: string
}) {
  const [quantity, setQuantity] = useState(1)
  const [variant, setVariant] = useState<CardVariant>("normal")

  const psa10 = useMemo(() => gradePrice(card, 10), [card])
  const psa9 = useMemo(() => gradePrice(card, 9), [card])

  const variants: { key: CardVariant; label: string }[] = [
    { key: "normal", label: "Normal" },
    { key: "holo", label: "Holo" },
    { key: "reverse", label: "Reverse" },
  ]

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-30 animate-in slide-in-from-bottom-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] duration-300",
        className,
      )}
    >
      <div className="rounded-2xl border border-primary/40 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
            {card.imageUrl ? (
              <Image src={card.imageUrl} alt="" fill className="object-cover" unoptimized />
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Card matched
            </p>
            <p className="truncate text-base font-semibold text-white">{card.cardName}</p>
            <p className="truncate text-xs text-white/60">
              {card.setName}
              {card.cardNumber ? ` · #${card.cardNumber}` : ""}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-white/50">Raw</p>
            <p className="text-sm font-semibold text-white">{formatPrice(card.rawPrice)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-white/50">PSA 10</p>
            <p className="text-sm font-semibold text-white">{formatPrice(psa10)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-white/50">PSA 9</p>
            <p className="text-sm font-semibold text-white">{formatPrice(psa9)}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-white/55">Variant</span>
          {variants.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setVariant(v.key)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                variant === v.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/10 text-white/75 hover:bg-white/15",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-white/15 bg-black/40">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="inline-flex size-9 items-center justify-center text-white/80 hover:text-white"
            >
              <Minus className="size-4" />
            </button>
            <span className="min-w-8 text-center text-sm font-semibold text-white">{quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              className="inline-flex size-9 items-center justify-center text-white/80 hover:text-white"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <button
            type="button"
            disabled={adding}
            onClick={() => void onAddToPortfolio({ quantity, variant })}
            className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {adding ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Add to Portfolio
          </button>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 w-full text-center text-[11px] font-medium text-white/45 hover:text-white/70"
        >
          Scan next card
        </button>
      </div>
    </div>
  )
}
