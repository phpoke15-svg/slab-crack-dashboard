"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronRight,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CardImage } from "@/components/trade-binder/binder/card-image"

const DEFAULT_GRADING_COST = 19

const GRADING_PRESETS = [
  { id: "bulk", label: "Bulk", cost: 15 },
  { id: "value", label: "Value", cost: 19 },
  { id: "regular", label: "Regular", cost: 50 },
  { id: "express", label: "Express", cost: 100 },
  { id: "super", label: "Super", cost: 150 },
] as const

type ReleaseEra = "3y" | "5y"
type SortMode = "spread" | "multiplier" | "roi"

type ScannerCard = {
  id: string
  name: string
  set: string
  era: string
  yearsAgo: number
  rawPrice: number
  psa10Price: number
  psa9Price: number
  gemRate: number
  image: string
  cardNumber: string
}

const MOCK_CARDS: ScannerCard[] = [
  {
    id: "charizard-151",
    name: "Charizard ex",
    set: "151",
    cardNumber: "223",
    era: "SV",
    yearsAgo: 2,
    rawPrice: 185,
    psa10Price: 620,
    psa9Price: 210,
    gemRate: 38,
    image: "https://images.pokemontcg.io/sv3pt5/223_hires.png",
  },
  {
    id: "mew-151",
    name: "Mew ex",
    set: "151",
    cardNumber: "205",
    era: "SV",
    yearsAgo: 2,
    rawPrice: 72,
    psa10Price: 285,
    psa9Price: 68,
    gemRate: 42,
    image: "https://images.pokemontcg.io/sv3pt5/205_hires.png",
  },
  {
    id: "alakazam-151",
    name: "Alakazam ex",
    set: "151",
    cardNumber: "201",
    era: "SV",
    yearsAgo: 2,
    rawPrice: 28,
    psa10Price: 145,
    psa9Price: 34,
    gemRate: 51,
    image: "https://images.pokemontcg.io/sv3pt5/201_hires.png",
  },
  {
    id: "ivysaur-151",
    name: "Ivysaur",
    set: "151",
    cardNumber: "167",
    era: "SV",
    yearsAgo: 2,
    rawPrice: 18,
    psa10Price: 95,
    psa9Price: 22,
    gemRate: 55,
    image: "https://images.pokemontcg.io/sv3pt5/167_hires.png",
  },
  {
    id: "mireidon-pei",
    name: "Miraidon ex",
    set: "Paldea Evolved",
    cardNumber: "253",
    era: "SV",
    yearsAgo: 3,
    rawPrice: 48,
    psa10Price: 210,
    psa9Price: 55,
    gemRate: 44,
    image: "https://images.pokemontcg.io/sv2/253_hires.png",
  },
  {
    id: "magikarp-pei",
    name: "Magikarp",
    set: "Paldea Evolved",
    cardNumber: "203",
    era: "SV",
    yearsAgo: 3,
    rawPrice: 95,
    psa10Price: 410,
    psa9Price: 88,
    gemRate: 29,
    image: "https://images.pokemontcg.io/sv2/203_hires.png",
  },
  {
    id: "iono-pei",
    name: "Iono",
    set: "Paldea Evolved",
    cardNumber: "269",
    era: "SV",
    yearsAgo: 3,
    rawPrice: 42,
    psa10Price: 175,
    psa9Price: 48,
    gemRate: 47,
    image: "https://images.pokemontcg.io/sv2/269_hires.png",
  },
  {
    id: "giratina-cz",
    name: "Giratina VSTAR",
    set: "Crown Zenith",
    cardNumber: "GG70",
    era: "SWSH",
    yearsAgo: 3,
    rawPrice: 210,
    psa10Price: 780,
    psa9Price: 240,
    gemRate: 33,
    image: "https://images.pokemontcg.io/swsh12pt5/GG70_hires.png",
  },
  {
    id: "pikachu-cz",
    name: "Pikachu",
    set: "Crown Zenith",
    cardNumber: "GG20",
    era: "SWSH",
    yearsAgo: 3,
    rawPrice: 55,
    psa10Price: 240,
    psa9Price: 62,
    gemRate: 48,
    image: "https://images.pokemontcg.io/swsh12pt5/GG20_hires.png",
  },
  {
    id: "arceus-cz",
    name: "Arceus VSTAR",
    set: "Crown Zenith",
    cardNumber: "GG70",
    era: "SWSH",
    yearsAgo: 3,
    rawPrice: 68,
    psa10Price: 295,
    psa9Price: 75,
    gemRate: 40,
    image: "https://images.pokemontcg.io/swsh12pt5/GG63_hires.png",
  },
  {
    id: "umbreon-evs",
    name: "Umbreon VMAX",
    set: "Evolving Skies",
    cardNumber: "215",
    era: "SWSH",
    yearsAgo: 4,
    rawPrice: 520,
    psa10Price: 1850,
    psa9Price: 480,
    gemRate: 22,
    image: "https://images.pokemontcg.io/swsh7/215_hires.png",
  },
  {
    id: "rayquaza-evs",
    name: "Rayquaza VMAX",
    set: "Evolving Skies",
    cardNumber: "218",
    era: "SWSH",
    yearsAgo: 4,
    rawPrice: 310,
    psa10Price: 1120,
    psa9Price: 295,
    gemRate: 26,
    image: "https://images.pokemontcg.io/swsh7/218_hires.png",
  },
  {
    id: "sylveon-evs",
    name: "Sylveon VMAX",
    set: "Evolving Skies",
    cardNumber: "212",
    era: "SWSH",
    yearsAgo: 4,
    rawPrice: 145,
    psa10Price: 520,
    psa9Price: 155,
    gemRate: 35,
    image: "https://images.pokemontcg.io/swsh7/212_hires.png",
  },
  {
    id: "moonbreon-sm",
    name: "Umbreon GX",
    set: "Sun & Moon",
    cardNumber: "60",
    era: "SM",
    yearsAgo: 5,
    rawPrice: 95,
    psa10Price: 420,
    psa9Price: 110,
    gemRate: 31,
    image: "https://images.pokemontcg.io/sm5/60_hires.png",
  },
  {
    id: "lunala-sm",
    name: "Lunala GX",
    set: "Sun & Moon",
    cardNumber: "66",
    era: "SM",
    yearsAgo: 5,
    rawPrice: 58,
    psa10Price: 265,
    psa9Price: 52,
    gemRate: 36,
    image: "https://images.pokemontcg.io/sm1/66_hires.png",
  },
  {
    id: "tapu-lele-sm",
    name: "Tapu Lele GX",
    set: "Guardians Rising",
    cardNumber: "60",
    era: "SM",
    yearsAgo: 5,
    rawPrice: 42,
    psa10Price: 190,
    psa9Price: 48,
    gemRate: 41,
    image: "https://images.pokemontcg.io/sm2/60_hires.png",
  },
  {
    id: "charizard-obs",
    name: "Charizard ex",
    set: "Obsidian Flames",
    cardNumber: "223",
    era: "SV",
    yearsAgo: 2,
    rawPrice: 125,
    psa10Price: 455,
    psa9Price: 140,
    gemRate: 37,
    image: "https://images.pokemontcg.io/sv3/223_hires.png",
  },
  {
    id: "pidgeot-obs",
    name: "Pidgeot ex",
    set: "Obsidian Flames",
    cardNumber: "225",
    era: "SV",
    yearsAgo: 2,
    rawPrice: 32,
    psa10Price: 155,
    psa9Price: 28,
    gemRate: 49,
    image: "https://images.pokemontcg.io/sv3/225_hires.png",
  },
]

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

export function Psa10SpreadScanner() {
  const [era, setEra] = useState<ReleaseEra>("3y")
  const [minGemRate, setMinGemRate] = useState(25)
  const [gradingCost, setGradingCost] = useState(DEFAULT_GRADING_COST)
  const [sortMode, setSortMode] = useState<SortMode>("roi")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const maxYears = era === "3y" ? 3 : 5
    const filtered = MOCK_CARDS.filter(
      (c) => c.yearsAgo <= maxYears && c.gemRate >= minGemRate,
    ).map((c) => computeRow(c, gradingCost))

    filtered.sort((a, b) => {
      if (sortMode === "spread") return b.grossSpread - a.grossSpread
      if (sortMode === "multiplier") return b.gradedMultiplier - a.gradedMultiplier
      return b.trueRoiScore - a.trueRoiScore
    })
    return filtered
  }, [era, minGemRate, gradingCost, sortMode])

  const selected = rows.find((r) => r.id === selectedId) ?? null

  useEffect(() => {
    if (selectedId && !rows.some((r) => r.id === selectedId)) setSelectedId(null)
  }, [rows, selectedId])

  const activePreset = GRADING_PRESETS.find((p) => p.cost === gradingCost)?.id ?? null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {/* Compact controls */}
      <section className="sticky top-0 z-20 space-y-3 rounded-2xl border border-border bg-background/90 p-3 backdrop-blur-xl sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={era}
            onChange={(e) => setEra(e.target.value as ReleaseEra)}
            aria-label="Release era"
            className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-secondary/60 px-3 text-xs font-medium text-foreground outline-none focus:border-primary/50 sm:flex-none sm:text-sm"
          >
            <option value="3y">Past 3 years</option>
            <option value="5y">Past 5 years</option>
          </select>

          <div
            className="flex rounded-xl border border-border bg-secondary/40 p-0.5"
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
              Grade cost ${gradingCost}
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {GRADING_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setGradingCost(preset.cost)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[10px] font-medium",
                    activePreset === preset.id
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={10}
              max={200}
              value={gradingCost}
              onChange={(e) => setGradingCost(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--primary)]"
            />
          </label>
        </div>
      </section>

      <p className="px-0.5 text-[11px] text-muted-foreground">
        {rows.length} cards · tap a card for full breakdown · mock comps
      </p>

      {/* Simplified feed */}
      <div className="flex flex-col gap-2.5">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
            No cards match these filters.
          </div>
        ) : (
          rows.map((row, index) => {
            const metric = primaryMetric(row, sortMode)
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-all",
                  "hover:border-primary/40 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  row.primeSlot && "border-primary/25",
                )}
              >
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
                <div className="flex shrink-0 flex-col items-end gap-1">
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
                  <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden="true" />
                </div>
              </button>
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

          <p className="mt-4 text-[11px] text-muted-foreground">
            Yield uses your selected grading cost. Mock market comps for demo — not live pricing.
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
