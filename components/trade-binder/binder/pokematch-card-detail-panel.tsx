"use client"

import { useEffect, useState } from "react"
import { Activity, ExternalLink, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { PriceHistoryChart } from "@/components/PriceHistoryChart"
import { PriceHistoryChart as LegacyPriceHistoryChart } from "@/components/price-history-chart"
import { RecentSalesList } from "@/components/recent-sales-list"
import { CardImage } from "@/components/trade-binder/binder/card-image"
import { ebaySearchUrl } from "@/lib/ebay-affiliate"
import type { PokeMatchCardDetailPayload, PokeMatchRecentSale } from "@/lib/trade-binder/pokematch-card-full"

type CardSalesResponse = {
  recentRawSales?: PokeMatchRecentSale[]
  error?: string
}

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "Unknown"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function formatUsd(value: number): string {
  return value >= 100 ? `$${value.toFixed(0)}` : `$${value.toFixed(2)}`
}

export function PokeMatchCardDetailPanel({
  payload,
  onClose,
}: {
  payload: PokeMatchCardDetailPayload
  onClose: () => void
}) {
  const [liveRawSales, setLiveRawSales] = useState<PokeMatchRecentSale[] | null>(null)
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesError, setSalesError] = useState<string | null>(null)

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    setSalesLoading(true)
    setSalesError(null)
    setLiveRawSales(null)

    const params = new URLSearchParams({
      id: payload.id,
      game: payload.game,
      rawOnly: "true",
    })
    if (payload.catalogId) params.set("catalogId", payload.catalogId)
    if (payload.scrydexId) params.set("scrydexId", payload.scrydexId)

    void fetch(`/api/tcg-research/sales?${params.toString()}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as CardSalesResponse | null
        if (cancelled) return
        if (!res.ok || !data) {
          setSalesError(data?.error ?? "Could not load sold comps")
          return
        }
        setLiveRawSales(Array.isArray(data.recentRawSales) ? data.recentRawSales : [])
      })
      .catch(() => {
        if (!cancelled) setSalesError("Could not load sold comps")
      })
      .finally(() => {
        if (!cancelled) setSalesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [payload.catalogId, payload.game, payload.id, payload.scrydexId])

  const priced = payload.hasPricing && payload.rawPrice > 0
  const rawSales = liveRawSales ?? payload.recentRawSales ?? []
  const ebayUrl = ebaySearchUrl(
    `${payload.name} ${payload.cardNumber} NM`,
    `pokematch-${payload.id}-raw`,
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close card details"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${payload.name} market details`}
        className={cn(
          "relative flex max-h-[92vh] w-full max-w-2xl animate-slide-up flex-col overflow-hidden rounded-t-3xl border border-border bg-popover",
          "sm:rounded-3xl",
        )}
      >
        <div className="relative flex items-center justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full bg-border sm:hidden" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
          <div className="flex gap-4">
            <div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-lg sm:w-28">
              <CardImage
                card={{
                  id: payload.id,
                  name: payload.name,
                  set: payload.setName,
                  image: payload.imageUrl,
                  rarity: "Common",
                  cardNumber: payload.cardNumber,
                }}
                alt={payload.name}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-foreground">{payload.name}</h2>
              <p className="text-sm text-muted-foreground">
                {payload.setName}
                {payload.cardNumber ? ` · #${payload.cardNumber}` : ""}
              </p>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Updated {formatUpdatedAt(payload.priceUpdatedAt)}
                {payload.priceSource ? ` · ${payload.priceSource}` : ""}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-secondary/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Raw market price
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
              {priced ? formatUsd(payload.rawPrice) : "—"}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">{payload.marketInsight}</p>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="font-semibold text-foreground">Recent raw sold comps</h4>
              {salesLoading ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
            </div>
            {salesError ? <p className="mb-3 text-sm text-destructive">{salesError}</p> : null}
            <RecentSalesList
              title="Raw NM"
              sales={rawSales}
              emptyMessage="No recent raw sold comps found."
              defaultOpen
            />
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 px-0.5">
              <Activity className="size-4 text-primary" />
              <h4 className="font-semibold text-foreground">Price history</h4>
            </div>
            {payload.scrydexId ? (
              <PriceHistoryChart scrydexId={payload.scrydexId} game={payload.game} days={90} />
            ) : (
              <LegacyPriceHistoryChart
                cardId={payload.catalogId ?? payload.id}
                currentRaw={payload.rawPrice}
                historyEndpoint="/api/tcg-research/price-history"
                historyQuery={{
                  catalogId: payload.catalogId ?? undefined,
                  scrydexId: payload.scrydexId ?? undefined,
                  game: payload.game,
                  rawOnly: "true",
                }}
                title="Price history · raw NM"
                subtitle="Raw market history only"
                rawOnly
              />
            )}
          </div>

          <a
            href={ebayUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ExternalLink className="size-4" />
            Search eBay raw NM
          </a>
        </div>
      </div>
    </div>
  )
}
