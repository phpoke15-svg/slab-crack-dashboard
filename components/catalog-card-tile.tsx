"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { SlabCardImage } from "@/components/slab-card-image"
import { AnimatedPrice, ConditionBadge } from "@/components/ui/micro-interactions"

export type CatalogCardTileProps = {
  cardId: string
  cardName: string
  setName: string
  cardNumber?: string
  imageUrl?: string | null
  rawPrice?: number
  rawLabel?: string
  secondaryLabel?: string
  secondaryPrice?: number
  secondaryHint?: string
  priced?: boolean
  pricingPending?: boolean
  rank?: number
  badge?: ReactNode
  topRight?: ReactNode
  footer?: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  /** Bumps price flash when webhook/cache refresh timestamp changes. */
  priceRefreshTrigger?: string | null
}

function formatPrice(value: number): string {
  return value >= 100 ? `$${value.toFixed(0)}` : `$${value.toFixed(2)}`
}

export function CatalogCardTile({
  cardId,
  cardName,
  setName,
  cardNumber,
  imageUrl,
  rawPrice = 0,
  rawLabel = "Raw NM",
  secondaryLabel,
  secondaryPrice,
  secondaryHint,
  priced = true,
  pricingPending = false,
  rank,
  badge,
  topRight,
  footer,
  onClick,
  disabled = false,
  className,
  priceRefreshTrigger,
}: CatalogCardTileProps) {
  const hasRaw = rawPrice > 0
  const hasSecondary = (secondaryPrice ?? 0) > 0
  const interactive = Boolean(onClick && !disabled)

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-card",
        interactive && "catalog-card-hover hover:border-primary/40 hover:bg-card/90",
        disabled && "opacity-60",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || !onClick}
        className="relative aspect-[3/4] overflow-hidden border-b border-border bg-muted/40 text-left transition-colors hover:bg-muted/60 disabled:cursor-default"
      >
        <SlabCardImage
          card={{
            id: cardId,
            cardName,
            setName,
            imageUrl: imageUrl ?? undefined,
            cardNumber,
          }}
          alt={`${cardName} card artwork`}
          sizes="(max-width: 640px) 45vw, 220px"
          className="object-contain p-1.5 transition-transform duration-200 ease-out group-hover:scale-[1.02]"
        />
        {rank != null ? (
          <span className="absolute left-1.5 top-1.5 rounded-md border border-border/80 bg-background/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
            #{rank}
          </span>
        ) : null}
        {badge ? <div className="absolute bottom-1.5 left-1.5">{badge}</div> : null}
        {topRight ? <div className="absolute right-1.5 top-1.5 flex flex-col gap-1">{topRight}</div> : null}
      </button>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || !onClick}
          className="min-w-0 text-left transition-colors hover:text-primary disabled:cursor-default"
        >
          <h3 className="truncate text-sm font-semibold leading-tight text-foreground">{cardName}</h3>
          <p className="truncate text-[11px] text-muted-foreground">
            {setName}
            {cardNumber ? ` · #${cardNumber}` : ""}
          </p>
          <div className="mt-1.5 space-y-0.5">
            {hasRaw ? (
              <p className="font-mono text-[11px] font-medium tabular-nums">
                <ConditionBadge label={rawLabel} className="text-muted-foreground">
                  {rawLabel}
                </ConditionBadge>{" "}
                <AnimatedPrice
                  value={rawPrice}
                  formatted={formatPrice(rawPrice)}
                  refreshTrigger={priceRefreshTrigger}
                  className="text-primary"
                />
              </p>
            ) : pricingPending ? (
              <p className="text-[11px] text-muted-foreground">Pricing…</p>
            ) : priced ? (
              <p className="text-[11px] text-muted-foreground">Tap for market data</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Awaiting sync</p>
            )}
            {secondaryLabel && hasSecondary ? (
              <p className="font-mono text-[11px] tabular-nums text-foreground/90">
                <ConditionBadge label={secondaryLabel}>{secondaryLabel}</ConditionBadge>{" "}
                <AnimatedPrice
                  value={secondaryPrice!}
                  formatted={formatPrice(secondaryPrice!)}
                  refreshTrigger={priceRefreshTrigger}
                />
              </p>
            ) : secondaryHint ? (
              <p className="text-[10px] text-muted-foreground">{secondaryHint}</p>
            ) : null}
          </div>
        </button>
        {footer}
      </div>
    </article>
  )
}
