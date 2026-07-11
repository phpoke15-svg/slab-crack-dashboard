"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  Gauge,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

const DEFAULT_GRADING_COST = 19

/** Common PSA-style all-in cost presets (fee + typical ship share). */
const GRADING_PRESETS = [
  { id: "bulk", label: "Bulk / economy", cost: 15 },
  { id: "value", label: "Value", cost: 19 },
  { id: "regular", label: "Regular", cost: 50 },
  { id: "express", label: "Express", cost: 100 },
  { id: "super", label: "Super express", cost: 150 },
] as const

type ReleaseEra = "3y" | "5y"
type SortMode = "spread" | "multiplier" | "roi"

type ScannerCard = {
  id: string
  name: string
  set: string
  era: string
  /** Years since release — used for era filter */
  yearsAgo: number
  rawPrice: number
  psa10Price: number
  psa9Price: number
  /** Statistical PSA 10 rate from pop reports (0–100) */
  gemRate: number
}

const MOCK_CARDS: ScannerCard[] = [
  {
    id: "charizard-151",
    name: "Charizard ex",
    set: "151 · #223",
    era: "SV",
    yearsAgo: 2,
    rawPrice: 185,
    psa10Price: 620,
    psa9Price: 210,
    gemRate: 38,
  },
  {
    id: "mew-151",
    name: "Mew ex",
    set: "151 · #205",
    era: "SV",
    yearsAgo: 2,
    rawPrice: 72,
    psa10Price: 285,
    psa9Price: 68,
    gemRate: 42,
  },
  {
    id: "alakazam-151",
    name: "Alakazam ex",
    set: "151 · #201",
    era: "SV",
    yearsAgo: 2,
    rawPrice: 28,
    psa10Price: 145,
    psa9Price: 34,
    gemRate: 51,
  },
  {
    id: "ivysaur-151",
    name: "Ivysaur",
    set: "151 · #167",
    era: "SV",
    yearsAgo: 2,
    rawPrice: 18,
    psa10Price: 95,
    psa9Price: 22,
    gemRate: 55,
  },
  {
    id: "mireidon-pei",
    name: "Miraidon ex",
    set: "Paldea Evolved · #253",
    era: "SV",
    yearsAgo: 3,
    rawPrice: 48,
    psa10Price: 210,
    psa9Price: 55,
    gemRate: 44,
  },
  {
    id: "magikarp-pei",
    name: "Magikarp",
    set: "Paldea Evolved · #203",
    era: "SV",
    yearsAgo: 3,
    rawPrice: 95,
    psa10Price: 410,
    psa9Price: 88,
    gemRate: 29,
  },
  {
    id: "iono-pei",
    name: "Iono",
    set: "Paldea Evolved · #269",
    era: "SV",
    yearsAgo: 3,
    rawPrice: 42,
    psa10Price: 175,
    psa9Price: 48,
    gemRate: 47,
  },
  {
    id: "giratina-cz",
    name: "Giratina VSTAR",
    set: "Crown Zenith · #GG70",
    era: "SWSH",
    yearsAgo: 3,
    rawPrice: 210,
    psa10Price: 780,
    psa9Price: 240,
    gemRate: 33,
  },
  {
    id: "pikachu-cz",
    name: "Pikachu",
    set: "Crown Zenith · #GG20",
    era: "SWSH",
    yearsAgo: 3,
    rawPrice: 55,
    psa10Price: 240,
    psa9Price: 62,
    gemRate: 48,
  },
  {
    id: "arceus-cz",
    name: "Arceus VSTAR",
    set: "Crown Zenith · #GG70",
    era: "SWSH",
    yearsAgo: 3,
    rawPrice: 68,
    psa10Price: 295,
    psa9Price: 75,
    gemRate: 40,
  },
  {
    id: "umbreon-evs",
    name: "Umbreon VMAX",
    set: "Evolving Skies · #215",
    era: "SWSH",
    yearsAgo: 4,
    rawPrice: 520,
    psa10Price: 1850,
    psa9Price: 480,
    gemRate: 22,
  },
  {
    id: "rayquaza-evs",
    name: "Rayquaza VMAX",
    set: "Evolving Skies · #218",
    era: "SWSH",
    yearsAgo: 4,
    rawPrice: 310,
    psa10Price: 1120,
    psa9Price: 295,
    gemRate: 26,
  },
  {
    id: "sylveon-evs",
    name: "Sylveon VMAX",
    set: "Evolving Skies · #212",
    era: "SWSH",
    yearsAgo: 4,
    rawPrice: 145,
    psa10Price: 520,
    psa9Price: 155,
    gemRate: 35,
  },
  {
    id: "moonbreon-sm",
    name: "Umbreon GX",
    set: "Sun & Moon · Full Art",
    era: "SM",
    yearsAgo: 5,
    rawPrice: 95,
    psa10Price: 420,
    psa9Price: 110,
    gemRate: 31,
  },
  {
    id: "lunala-sm",
    name: "Lunala GX",
    set: "Sun & Moon · Rainbow",
    era: "SM",
    yearsAgo: 5,
    rawPrice: 58,
    psa10Price: 265,
    psa9Price: 52,
    gemRate: 36,
  },
  {
    id: "tapu-lele-sm",
    name: "Tapu Lele GX",
    set: "Guardians Rising · #60",
    era: "SM",
    yearsAgo: 5,
    rawPrice: 42,
    psa10Price: 190,
    psa9Price: 48,
    gemRate: 41,
  },
  {
    id: "charizard-obs",
    name: "Charizard ex",
    set: "Obsidian Flames · #223",
    era: "SV",
    yearsAgo: 2,
    rawPrice: 125,
    psa10Price: 455,
    psa9Price: 140,
    gemRate: 37,
  },
  {
    id: "pidgeot-obs",
    name: "Pidgeot ex",
    set: "Obsidian Flames · #225",
    era: "SV",
    yearsAgo: 2,
    rawPrice: 32,
    psa10Price: 155,
    psa9Price: 28,
    gemRate: 49,
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
  const trueRoiScore = estimatedYield
  const dangerZone = card.psa9Price < card.rawPrice
  const primeSlot = estimatedYield > 150

  return {
    ...card,
    grossSpread,
    netSpread,
    gradedMultiplier,
    estimatedYield,
    trueRoiScore,
    gradingCost,
    dangerZone,
    primeSlot,
  }
}

const SORT_TABS: { id: SortMode; label: string; hint: string }[] = [
  { id: "spread", label: "Highest Gross Spread", hint: "PSA 10 − Raw" },
  { id: "multiplier", label: "Highest Multiplier", hint: "PSA 10 ÷ Raw" },
  { id: "roi", label: "Best Probability ROI", hint: "Gem-weighted yield" },
]

export function Psa10SpreadScanner() {
  const [era, setEra] = useState<ReleaseEra>("3y")
  const [minGemRate, setMinGemRate] = useState(25)
  const [gradingCost, setGradingCost] = useState(DEFAULT_GRADING_COST)
  const [sortMode, setSortMode] = useState<SortMode>("roi")

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

  const primeCount = rows.filter((r) => r.primeSlot).length
  const dangerCount = rows.filter((r) => r.dangerZone).length
  const activePreset = GRADING_PRESETS.find((p) => p.cost === gradingCost)?.id ?? null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      {/* Controls */}
      <section className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <label
                htmlFor="release-era"
                className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Release era
              </label>
              <select
                id="release-era"
                value={era}
                onChange={(e) => setEra(e.target.value as ReleaseEra)}
                className="mt-1.5 h-11 w-full max-w-md rounded-xl border border-border bg-secondary/60 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50"
              >
                <option value="3y">Past 3 Years — Sword &amp; Shield / Scarlet &amp; Violet</option>
                <option value="5y">Past 5 Years — Sun &amp; Moon era forward</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="grading-cost"
                  className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Grading cost (all-in)
                </label>
                <span className="font-mono text-sm font-semibold text-primary tabular-nums">
                  ${gradingCost.toFixed(gradingCost % 1 === 0 ? 0 : 2)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {GRADING_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setGradingCost(preset.cost)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                      activePreset === preset.id
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/35 hover:text-foreground",
                    )}
                  >
                    {preset.label} · ${preset.cost}
                  </button>
                ))}
              </div>
              <input
                id="grading-cost"
                type="range"
                min={10}
                max={200}
                step={1}
                value={gradingCost}
                onChange={(e) => setGradingCost(Number(e.target.value))}
                className="mt-3 w-full accent-[var(--primary)]"
                aria-valuemin={10}
                aria-valuemax={200}
                aria-valuenow={gradingCost}
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>$10</span>
                <span>PSA fee + shipping share</span>
                <span>$200</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="gem-rate"
                  className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Min PSA 10 gem rate
                </label>
                <span className="font-mono text-sm font-semibold text-primary tabular-nums">
                  {minGemRate}%
                </span>
              </div>
              <input
                id="gem-rate"
                type="range"
                min={10}
                max={80}
                step={1}
                value={minGemRate}
                onChange={(e) => setMinGemRate(Number(e.target.value))}
                className="mt-3 w-full accent-[var(--primary)]"
                aria-valuemin={10}
                aria-valuemax={80}
                aria-valuenow={minGemRate}
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>10%</span>
                <span>Based on PSA pop reports</span>
                <span>80%</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground lg:justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5">
              <Gauge className="size-3.5 text-primary" aria-hidden="true" />
              {rows.length} cards
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              {primeCount} prime
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-destructive">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              {dangerCount} 10-or-bust
            </span>
          </div>
        </div>

        <div
          className="mt-5 flex gap-1 overflow-x-auto rounded-xl border border-border bg-secondary/30 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Sort leaderboard"
        >
          {SORT_TABS.map((tab) => {
            const active = sortMode === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSortMode(tab.id)}
                className={cn(
                  "relative min-w-[9.5rem] flex-1 rounded-lg px-3 py-2.5 text-left transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_0_24px_-8px] shadow-primary/50"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold sm:text-sm">
                  {tab.id === "spread" ? (
                    <TrendingUp className="size-3.5 shrink-0" aria-hidden="true" />
                  ) : tab.id === "multiplier" ? (
                    <ArrowDownWideNarrow className="size-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
                  )}
                  {tab.label}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block text-[10px]",
                    active ? "text-primary-foreground/75" : "text-muted-foreground",
                  )}
                >
                  {tab.hint}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <p className="px-0.5 text-[11px] leading-relaxed text-muted-foreground">
        Yield model:{" "}
        <span className="font-mono text-foreground/80">
          (PSA10 × gem%/100) − raw − grading (${gradingCost})
        </span>
        . Gross spread ignores fees; True ROI and net spread subtract grading cost. Mock comps for
        demo.
      </p>

      {/* Leaderboard */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-3 font-semibold sm:px-4">Rank</th>
                <th className="px-3 py-3 font-semibold sm:px-4">Card</th>
                <th className="px-3 py-3 font-semibold sm:px-4">Set / Era</th>
                <th className="px-3 py-3 text-right font-semibold sm:px-4">Raw</th>
                <th className="px-3 py-3 text-right font-semibold sm:px-4">PSA 10</th>
                <th className="px-3 py-3 text-right font-semibold sm:px-4">Gross / net</th>
                <th className="px-3 py-3 text-right font-semibold sm:px-4">Gem rate</th>
                <th className="px-3 py-3 text-right font-semibold sm:px-4">True ROI score</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-foreground">
                    No cards match this gem-rate floor. Lower the threshold to widen the scan.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border/70 transition-colors hover:bg-secondary/30",
                      row.primeSlot && "bg-primary/[0.04]",
                    )}
                  >
                    <td className="px-3 py-3.5 font-mono text-xs text-muted-foreground sm:px-4">
                      #{index + 1}
                    </td>
                    <td className="px-3 py-3.5 sm:px-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-semibold text-foreground">{row.name}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {row.primeSlot && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary shadow-[0_0_16px_-4px] shadow-primary/70 animate-pulse-glow">
                              <Sparkles className="size-3" aria-hidden="true" />
                              Prime Submission Slot
                            </span>
                          )}
                          {row.dangerZone && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                              <AlertTriangle className="size-3" aria-hidden="true" />
                              Danger Zone · 10-or-Bust
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-muted-foreground sm:px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-foreground/90">{row.set}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {row.era}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono tabular-nums text-foreground sm:px-4">
                      {money(row.rawPrice)}
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono tabular-nums text-foreground sm:px-4">
                      {money(row.psa10Price)}
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono font-semibold tabular-nums text-primary sm:px-4">
                      {money(row.grossSpread)}
                      <span
                        className={cn(
                          "mt-0.5 block text-[10px] font-normal",
                          row.netSpread >= 0 ? "text-muted-foreground" : "text-destructive",
                        )}
                      >
                        net {money(row.netSpread)} after grade
                      </span>
                      <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                        {row.gradedMultiplier.toFixed(2)}×
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right sm:px-4">
                      <span className="font-mono tabular-nums text-foreground">{row.gemRate}%</span>
                    </td>
                    <td className="px-3 py-3.5 text-right sm:px-4">
                      <span
                        className={cn(
                          "font-mono text-base font-bold tabular-nums",
                          row.trueRoiScore >= 0 ? "text-primary" : "text-destructive",
                        )}
                      >
                        {money(row.trueRoiScore)}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        net @ {row.gemRate}% − ${row.gradingCost} grade
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
