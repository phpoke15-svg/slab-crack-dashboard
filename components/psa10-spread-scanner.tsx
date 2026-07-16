"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  Bookmark,
  Camera,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  Search,
  Sparkles,
  Star,
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
import { SaveForLaterButton } from "@/components/save-for-later/save-for-later-button"
import { WatchlistButton } from "@/components/save-for-later/watchlist-button"
import {
  isSavedForLater,
  loadSaveForLaterStore,
  resolveSavedSlabLabCards,
  saveSaveForLaterStore,
  savedCountForSource,
  toggleSavedForLater,
  type SaveForLaterStore,
} from "@/lib/save-for-later-storage"
import {
  isSlabLabWatched,
  loadSlabLabWatchlistStore,
  resolveSlabLabWatchedCards,
  saveSlabLabWatchlistStore,
  toggleSlabLabWatchlistCard,
  type SlabLabWatchlistStore,
} from "@/lib/slablab-watchlist-storage"

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
type SlabLabView = "board" | "watchlist" | "saved"

type ScannerCard = SlabLabCard

type ComputedRow = ScannerCard & {
  grossSpread: number
  netSpread: number
  gradedMultiplier: number
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
  return {
    ...card,
    grossSpread,
    netSpread,
    gradedMultiplier,
    trueRoiScore: netSpread,
    gradingCost,
    dangerZone: card.psa9Price > 0 && card.psa9Price < card.rawPrice,
    primeSlot: netSpread > 150,
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
  const [gradingCost, setGradingCost] = useState(DEFAULT_GRADING_COST)
  const [sortMode, setSortMode] = useState<SortMode>("roi")
  const [view, setView] = useState<SlabLabView>("board")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [saveStore, setSaveStore] = useState<SaveForLaterStore>({ folders: [], items: [] })
  const [watchlistStore, setWatchlistStore] = useState<SlabLabWatchlistStore>({
    ids: [],
    cards: {},
  })

  useEffect(() => {
    setSaveStore(loadSaveForLaterStore())
    setWatchlistStore(loadSlabLabWatchlistStore())
  }, [])

  useEffect(() => {
    saveSaveForLaterStore(saveStore)
  }, [saveStore])

  useEffect(() => {
    saveSlabLabWatchlistStore(watchlistStore)
  }, [watchlistStore])

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

  const liveById = useMemo(() => {
    const map = new Map<string, ScannerCard>()
    for (const card of cards) map.set(card.watchlistId || card.id, card)
    return map
  }, [cards])

  const savedCards = useMemo(
    () => resolveSavedSlabLabCards(saveStore, liveById),
    [saveStore, liveById],
  )

  const watchedCards = useMemo(
    () => resolveSlabLabWatchedCards(watchlistStore, liveById),
    [watchlistStore, liveById],
  )

  const sourceCards =
    view === "saved" ? savedCards : view === "watchlist" ? watchedCards : cards

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? sourceCards.filter((c) => {
          const haystack = `${c.name} ${c.set} ${c.cardNumber}`.toLowerCase()
          return haystack.includes(q)
        })
      : sourceCards
    const computed = filtered.map((c) => computeRow(c, gradingCost))

    computed.sort((a, b) => {
      if (sortMode === "spread") return b.grossSpread - a.grossSpread
      if (sortMode === "multiplier") return b.gradedMultiplier - a.gradedMultiplier
      return b.trueRoiScore - a.trueRoiScore
    })
    return view === "board" ? computed : computed
  }, [gradingCost, query, sortMode, sourceCards, view])

  const toggleSave = (card: ScannerCard) => {
    setSaveStore((prev) => toggleSavedForLater(prev, { source: "slablab", card }))
  }

  const toggleWatch = (card: ScannerCard) => {
    setWatchlistStore((prev) => toggleSlabLabWatchlistCard(prev, card))
  }

  const isRowSaved = (row: ScannerCard) =>
    isSavedForLater(saveStore, "slablab", row.watchlistId || row.id)

  const isRowWatched = (row: ScannerCard) => isSlabLabWatched(watchlistStore, row)

  const selected = rows.find((r) => r.id === selectedId) ?? null

  useEffect(() => {
    if (selectedId && !rows.some((r) => r.id === selectedId)) setSelectedId(null)
  }, [rows, selectedId])

  const activePreset = findPsaTierByFee(gradingCost)?.id ?? null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {/* Compact controls */}
      <section className="sticky top-0 z-20 space-y-3 rounded-2xl border border-border bg-background/90 p-3 backdrop-blur-xl sm:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter board by card, set, or number…"
            className={cn(
              "h-11 w-full rounded-xl border border-border bg-secondary/60 pl-10 pr-[4.75rem] text-sm text-foreground placeholder:text-muted-foreground",
              "outline-none transition-colors focus:border-primary/50 focus:bg-secondary",
            )}
          />
          <Link
            href="/slablab/scan"
            className="absolute right-1.5 top-1/2 inline-flex h-8 -translate-y-1/2 items-center gap-1 rounded-lg border border-primary/40 bg-primary/15 px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/25"
            aria-label="Scan a card"
          >
            <Camera className="size-3.5" aria-hidden />
            Scan
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-xl border border-border bg-secondary/40 p-0.5"
            role="tablist"
            aria-label="SlabLab view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === "board"}
              onClick={() => setView("board")}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors sm:text-xs",
                view === "board"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Board
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "watchlist"}
              onClick={() => setView("watchlist")}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors sm:text-xs",
                view === "watchlist"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Star className="size-3.5" aria-hidden />
              Watchlist
              {watchlistStore.ids.length > 0 ? (
                <span className="rounded-full bg-primary-foreground/15 px-1.5 py-0.5 font-mono text-[10px]">
                  {watchlistStore.ids.length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "saved"}
              onClick={() => setView("saved")}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors sm:text-xs",
                view === "saved"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FolderOpen className="size-3.5" aria-hidden />
              Saved
              {savedCountForSource(saveStore, "slablab") > 0 ? (
                <span className="rounded-full bg-primary-foreground/15 px-1.5 py-0.5 font-mono text-[10px]">
                  {savedCountForSource(saveStore, "slablab")}
                </span>
              ) : null}
            </button>
          </div>

          {view === "board" ? (
            <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">All-time scan</p>
          ) : view === "watchlist" ? (
            <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
              Your watchlist
            </p>
          ) : (
            <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
              Saved for later folder
            </p>
          )}

          {view === "board" || view === "watchlist" || view === "saved" ? (
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
          ) : null}
        </div>

        {view === "board" ? (
          <div className="grid gap-3">
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
        ) : null}
      </section>

      <p className="px-0.5 text-[11px] text-muted-foreground">
        {view === "saved"
          ? rows.length === 0
            ? "Your Saved for later folder is empty. Tap the bookmark on any card to add it."
            : `${rows.length} saved card${rows.length === 1 ? "" : "s"} in your folder`
          : view === "watchlist"
            ? rows.length === 0
              ? "Your watchlist is empty. Tap the star on any card to track it here."
              : `${rows.length} card${rows.length === 1 ? "" : "s"} on your watchlist`
          : loading
            ? "Loading top grading opportunities…"
            : error
              ? error
              : `Top ${rows.length} of ${TOP_CARDS_LIMIT} · tap a card for full breakdown`}
      </p>

      {/* Simplified feed */}
      <div className="flex flex-col gap-2.5">
        {view === "board" && loading ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
            Scanning catalog for PSA 10 grading opportunities…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
            {view === "saved" ? (
              <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                <Bookmark className="size-8 text-muted-foreground/70" aria-hidden />
                <p>Nothing saved yet. Use Save for later on any grading candidate.</p>
              </div>
            ) : view === "watchlist" ? (
              <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                <Star className="size-8 text-muted-foreground/70" aria-hidden />
                <p>Nothing on your watchlist yet. Tap the star on any card to add it.</p>
              </div>
            ) : error ? (
              "Could not load opportunities. Try refresh."
            ) : (
              "No cards match yet. Wait for price sync or try again shortly."
            )}
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
                    {view === "board" ? index + 1 : "·"}
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
                    {isRowWatched(row) ? (
                      <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Sparkles className="size-2.5" />
                      </span>
                    ) : null}
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
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1">
                      <WatchlistButton
                        watched={isRowWatched(row)}
                        onToggle={() => toggleWatch(row)}
                        compact
                      />
                      <SaveForLaterButton
                        saved={isRowSaved(row)}
                        onToggle={() => toggleSave(row)}
                        compact
                      />
                    </div>
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
                  title="30-day sales · PSA 10"
                />
              </div>
            )
          })
        )}
      </div>

      {selected && (
        <SlabLabDetailDrawer
          row={selected}
          watched={isRowWatched(selected)}
          saved={isRowSaved(selected)}
          onToggleWatch={() => toggleWatch(selected)}
          onToggleSave={() => toggleSave(selected)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

function SlabLabDetailDrawer({
  row,
  watched,
  saved,
  onToggleWatch,
  onToggleSave,
  onClose,
}: {
  row: ComputedRow
  watched: boolean
  saved: boolean
  onToggleWatch: () => void
  onToggleSave: () => void
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
            <Stat
              label={row.psa10Estimated ? "PSA 10 (est.)" : "PSA 10"}
              value={money(row.psa10Price)}
            />
            <Stat label="PSA 9" value={money(row.psa9Price)} danger={row.dangerZone} />
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
              title="30-day sales · PSA 10"
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
              {money(row.psa10Price)} − {money(row.rawPrice)} − {money(row.gradingCost)} grading
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

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <WatchlistButton watched={watched} onToggle={onToggleWatch} className="flex-1" />
            <SaveForLaterButton saved={saved} onToggle={onToggleSave} className="flex-1" />
          </div>

          <p className="mt-4 text-[11px] text-muted-foreground">
            Watchlist and Saved for later are stored on this device.
          </p>

          <p className="mt-2 text-[11px] text-muted-foreground">
            ROI is PSA 10 price minus raw and your selected grading cost.
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
