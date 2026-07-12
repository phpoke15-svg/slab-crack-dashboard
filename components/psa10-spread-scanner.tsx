"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CardImage } from "@/components/trade-binder/binder/card-image"
import { ebaySearchUrl } from "@/lib/ebay-affiliate"
import {
  DEFAULT_PSA_GRADING_FEE,
  findPsaTierByFee,
  formatPsaFee,
  PSA_AVAILABLE_GRADING_TIERS,
  PSA_GRADING_TIERS,
} from "@/lib/psa-grading-tiers"
import type { SlabLabCard } from "@/lib/slablab"
import { PriceHistoryChart } from "@/components/price-history-chart"
import { TOP_CARDS_LIMIT } from "@/lib/top-cards"

const DEFAULT_GRADING_COST = DEFAULT_PSA_GRADING_FEE

const GRADING_PRESETS = PSA_GRADING_TIERS.map((tier) => ({
  id: tier.id,
  label: tier.label,
  cost: tier.fee,
  available: tier.available,
  name: tier.name,
}))

const AVAILABLE_FEES = PSA_AVAILABLE_GRADING_TIERS.map((t) => t.fee)
const GRADING_SLIDER_MIN = Math.floor(Math.min(...AVAILABLE_FEES))
const GRADING_SLIDER_MAX = Math.ceil(Math.max(...AVAILABLE_FEES))
type SortMode = "spread" | "multiplier" | "roi"

type ScannerCard = SlabLabCard

type ComputedRow = ScannerCard & {
  grossSpread: number
  netSpread: number
  gradedMultiplier: number
  estimatedYield: number
  trueRoiScore: number
  gradingCost: number
  dangerZone: boolean
  primeSlot: boolean
}

function money(n: number): string {
  const abs = Math.abs(n)
  const formatted = abs >= 100 ? abs.toFixed(0) : abs.toFixed(2)
  return `${n < 0 ? "-" : ""}$${formatted}`
}

function computeRow(card: ScannerCard, gradingCost: number): ComputedRow {
  const grossSpread = card.psa10Price - card.rawPrice
  const netSpread = grossSpread - gradingCost
  const gradedMultiplier = card.rawPrice > 0 ? card.psa10Price / card.rawPrice : 0
  const estimatedYield =
    card.psa10Price * (card.gemRate / 100) - card.rawPrice - gradingCost
  return {
    ...card,
    grossSpread,
    netSpread,
    gradedMultiplier,
    estimatedYield,
    trueRoiScore: estimatedYield,
    gradingCost,
    dangerZone: card.psa9Price < card.rawPrice,
    primeSlot: estimatedYield > 150,
  }
}

const SORT_TABS: { id: SortMode; label: string }[] = [
  { id: "roi", label: "Best ROI" },
  { id: "spread", label: "Spread" },
  { id: "multiplier", label: "Multiplier" },
]

function primaryMetric(row: ComputedRow, sortMode: SortMode): { label: string; value: string } {
  if (sortMode === "spread") return { label: "Gross", value: money(row.grossSpread) }
  if (sortMode === "multiplier") return { label: "Mult", value: `${row.gradedMultiplier.toFixed(2)}×` }
  return { label: "ROI", value: money(row.trueRoiScore) }
}

function cardEbayUrl(row: Pick<ScannerCard, "id" | "name" | "cardNumber">): string {
  return ebaySearchUrl(
    `${row.name} ${row.cardNumber} PSA 10`,
    `slablab-${row.id}`,
  )
}

export function Psa10SpreadScanner() {
  const [cards, setCards] = useState<ScannerCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [minGemRate, setMinGemRate] = useState(25)
  const [gradingCost, setGradingCost] = useState(DEFAULT_GRADING_COST)
  const [sortMode, setSortMode] = useState<SortMode>("roi")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/slablab", { credentials: "same-origin" })
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; cards?: ScannerCard[]; error?: string }
          | null
        if (!res.ok || !json?.cards) {
          throw new Error(json?.error || "Could not load grading opportunities")
        }
        if (!cancelled) setCards(json.cards)
      } catch (err) {
        if (!cancelled) {
          setCards([])
          setError(err instanceof Error ? err.message : "Could not load grading opportunities")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(() => {
    const filtered = cards
      .filter((c) => c.gemRate >= minGemRate)
      .map((c) => computeRow(c, gradingCost))

    filtered.sort((a, b) => {
      if (sortMode === "spread") return b.grossSpread - a.grossSpread
      if (sortMode === "multiplier") return b.gradedMultiplier - a.gradedMultiplier
      return b.trueRoiScore - a.trueRoiScore
    })
    return filtered.slice(0, TOP_CARDS_LIMIT)
  }, [cards, minGemRate, gradingCost, sortMode])

  const selected = rows.find((r) => r.id === selectedId) ?? null

  useEffect(() => {
    if (selectedId && !rows.some((r) => r.id === selectedId)) setSelectedId(null)
  }, [rows, selectedId])

  const activePreset = findPsaTierByFee(gradingCost)?.id ?? null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {/* Compact controls */}
      <section className="sticky top-0 z-20 space-y-3 rounded-2xl border border-border bg-background/90 p-3 backdrop-blur-xl sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
            All-time scan
          </p>

          <div
            className="ml-auto flex rounded-xl border border-border bg-secondary/40 p-0.5"
            role="tablist"
            aria-label="Sort"
          >
            {SORT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={sortMode === tab.id}
                onClick={() => setSortMode(tab.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors sm:text-xs",
                  sortMode === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Gem rate ≥{minGemRate}%
            </span>
            <input
              type="range"
              min={10}
              max={80}
              value={minGemRate}
              onChange={(e) => setMinGemRate(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--primary)]"
            />
          </label>
          <label className="block">
            <span className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Grade cost {formatPsaFee(gradingCost)}
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {GRADING_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setGradingCost(preset.cost)}
                  title={`${preset.name} · ${formatPsaFee(preset.cost)}${preset.available ? "" : " (paused)"}`}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[10px] font-medium",
                    activePreset === preset.id
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : preset.available
                        ? "border-border text-muted-foreground hover:text-foreground"
                        : "border-dashed border-border/70 text-muted-foreground/70",
                  )}
                >
                  {preset.label}
                  {!preset.available ? " · paused" : ""}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              All PSA tiers · Value levels are paused by PSA but still selectable for modeling.
            </p>
            <input
              type="range"
              min={GRADING_SLIDER_MIN}
              max={GRADING_SLIDER_MAX}
              step={1}
              value={Math.round(gradingCost)}
              onChange={(e) => setGradingCost(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--primary)]"
            />
          </label>
        </div>
      </section>

      <p className="px-0.5 text-[11px] text-muted-foreground">
        {loading
          ? "Loading top grading opportunities…"
          : error
            ? error
            : `Top ${rows.length} of ${TOP_CARDS_LIMIT} · tap a card for full breakdown`}
      </p>

      {/* Simplified feed */}
      <div className="flex flex-col gap-2.5">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
            Scanning catalog for PSA 10 grading opportunities…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
            {error
              ? "Could not load opportunities. Try refresh."
              : "No cards match these filters. Lower the gem-rate floor or wait for price sync."}
          </div>
        ) : (
          rows.map((row, index) => {
            const metric = primaryMetric(row, sortMode)
            return (
              <div
                key={row.watchlistId || row.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(row.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setSelectedId(row.id)
                  }
                }}
                className={cn(
                  "group flex w-full cursor-pointer flex-col gap-2.5 rounded-2xl border border-border bg-card p-3 text-left transition-all",
                  "hover:border-primary/40 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  row.primeSlot && "border-primary/25",
                )}
              >
                <div className="flex w-full items-center gap-3">
                  <span className="w-5 shrink-0 font-mono text-[11px] text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-muted/40 sm:w-16">
                    <CardImage
                      card={{
                        id: row.id,
                        name: row.name,
                        set: row.set,
                        image: row.image,
                        cardNumber: row.cardNumber,
                      }}
                      alt={`${row.name} card`}
                      sizes="64px"
                      className="object-contain p-0.5 transition-transform duration-300 group-hover:scale-105"
                      upgrade={false}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold text-foreground">{row.name}</h3>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        #{row.cardNumber}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.set} · {row.era}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {row.primeSlot && (
                        <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          Prime
                        </span>
                      )}
                      {row.dangerZone && (
                        <span className="rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                          10-or-bust
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{row.gemRate}% gem</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {metric.label}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-sm font-bold tabular-nums",
                        sortMode === "roi" && row.trueRoiScore < 0
                          ? "text-destructive"
                          : "text-primary",
                      )}
                    >
                      {metric.value}
                    </span>
                    <a
                      href={cardEbayUrl(row)}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/50 px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      eBay
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                </div>
                <PriceHistoryChart
                  cardId={row.watchlistId || row.id}
                  grade={10}
                  currentRaw={row.rawPrice}
                  currentSlab={row.psa10Price}
                  compact
                  title="30-day prices · PSA 10"
                />
              </div>
            )
          })
        )}
      </div>

      {selected && (
        <SlabLabDetailDrawer
          row={selected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

function SlabLabDetailDrawer({
  row,
  onClose,
}: {
  row: ComputedRow
  onClose: () => void
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${row.name} SlabLab details`}
        className={cn(
          "relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl",
          "sm:mx-4 sm:max-h-[85dvh] sm:rounded-3xl",
        )}
      >
        <div className="relative flex items-center justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full bg-border sm:hidden" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
          <div className="flex gap-4">
            <div className="relative aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-muted/40 sm:w-32">
              <CardImage
                card={{
                  id: row.id,
                  name: row.name,
                  set: row.set,
                  image: row.image,
                  cardNumber: row.cardNumber,
                }}
                alt={`${row.name} card`}
                sizes="128px"
                className="object-contain p-1"
                upgrade={false}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-foreground">{row.name}</h2>
              <p className="text-sm text-muted-foreground">
                {row.set} · #{row.cardNumber} · {row.era}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {row.primeSlot && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/15 px-2 py-1 text-[11px] font-semibold text-primary shadow-[0_0_16px_-4px] shadow-primary/70">
                    <Sparkles className="size-3" aria-hidden="true" />
                    Prime Submission Slot
                  </span>
                )}
                {row.dangerZone && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] font-semibold text-destructive">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    Danger Zone · 10-or-Bust
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <Stat label="Raw NM" value={money(row.rawPrice)} />
            <Stat label="PSA 10" value={money(row.psa10Price)} />
            <Stat label="PSA 9" value={money(row.psa9Price)} danger={row.dangerZone} />
            <Stat label="Gem rate" value={`${row.gemRate}%`} />
            <Stat label="Gross spread" value={money(row.grossSpread)} accent />
            <Stat label="Net after grade" value={money(row.netSpread)} accent={row.netSpread >= 0} danger={row.netSpread < 0} />
            <Stat label="Multiplier" value={`${row.gradedMultiplier.toFixed(2)}×`} />
            <Stat label="Grading cost" value={money(row.gradingCost)} />
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 px-0.5">
              <TrendingUp className="size-4 text-primary" />
              <h4 className="font-semibold text-foreground">Price History</h4>
            </div>
            <PriceHistoryChart
              cardId={row.watchlistId || row.id}
              grade={10}
              currentRaw={row.rawPrice}
              currentSlab={row.psa10Price}
              title="30-day prices · PSA 10"
            />
          </div>

          <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <TrendingUp className="size-3.5" aria-hidden="true" />
              True ROI score
            </div>
            <p
              className={cn(
                "mt-1 font-mono text-3xl font-bold tabular-nums",
                row.trueRoiScore >= 0 ? "text-primary" : "text-destructive",
              )}
            >
              {money(row.trueRoiScore)}
            </p>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
              ({money(row.psa10Price)} × {row.gemRate}%) − {money(row.rawPrice)} −{" "}
              {money(row.gradingCost)} grading
            </p>
          </div>

          {row.dangerZone && (
            <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs leading-relaxed text-destructive">
              PSA 9 ({money(row.psa9Price)}) sits below raw ({money(row.rawPrice)}). A 9 can lose money —
              this is a 10-or-bust submission.
            </p>
          )}

          <a
            href={cardEbayUrl(row)}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Search eBay PSA 10
          </a>

          <p className="mt-4 text-[11px] text-muted-foreground">
            Yield uses your selected grading cost and gem-rate estimate from sold comps when available.
          </p>
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
  danger,
}: {
  label: string
  value: string
  accent?: boolean
  danger?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-sm font-semibold tabular-nums",
          danger ? "text-destructive" : accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  )
}
