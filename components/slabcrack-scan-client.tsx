"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Layers, Loader2, RefreshCw, Search, ScanLine, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { DeficitBadge } from "@/components/deficit-badge"
import { GradePriceGrid } from "@/components/grade-price-grid"
import { SlabDrawer } from "@/components/slab-drawer"
import { CardScanner } from "@/components/card-scanner"
import { ScanMatchFeedback } from "@/components/scan-match-feedback"
import type { ScanPipelineResult } from "@/lib/scanner/types"
import { searchHitToPlaceholder, type CardSearchHit } from "@/lib/card-lookup"
import { DEFAULT_PSA_GRADING_FEE } from "@/lib/psa-grading-tiers"
import {
  getBestGradeQuote,
  getGradeQuotes,
  normalizeCardEntry,
  resolvePsa10Price,
  type MockCardEntry,
} from "@/lib/slab-data"

type ScanTool = "slabcrack" | "slablab"
type Phase = "camera" | "manual" | "hud"

function formatMoney(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—"
  return `$${n.toFixed(2)}`
}

function formatSigned(n: number) {
  if (!Number.isFinite(n)) return "—"
  const abs = Math.abs(n)
  const formatted = abs >= 100 ? abs.toFixed(0) : abs.toFixed(2)
  return `${n < 0 ? "-" : ""}$${formatted}`
}

export function SlabcrackScanClient({ tool = "slabcrack" }: { tool?: ScanTool }) {
  const backHref = tool === "slablab" ? "/slablab" : "/slabcrack"
  const multiScanHref = tool === "slablab" ? "/slablab/multi-scan" : "/slabcrack/multi-scan"
  const toolLabel = tool === "slablab" ? "SlabLab Scan" : "SlabCrack Scan"

  const seededHitsRef = useRef<CardSearchHit[]>([])
  const seedQueryRef = useRef("")
  const aiCandidatesRef = useRef<CardSearchHit[]>([])
  const presentedCardIdRef = useRef<string | null>(null)
  const priceRefreshGenRef = useRef(0)

  const [phase, setPhase] = useState<Phase>("camera")
  const [isScanning, setIsScanning] = useState(false)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [identifyStatus, setIdentifyStatus] = useState("Reading card…")

  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<CardSearchHit[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [detectedLabel, setDetectedLabel] = useState<string | null>(null)

  const [card, setCard] = useState<MockCardEntry | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [matchMeta, setMatchMeta] = useState<{
    matchMethod?: "visual_phash" | "vision"
    matchScore?: number
  } | null>(null)

  const enterManualHandoff = useCallback(
    (opts: {
      query: string
      candidates?: CardSearchHit[]
      error: string
      label?: string | null
    }) => {
      const nextQuery = opts.query.trim()
      const nextHits = opts.candidates ?? []
      seedQueryRef.current = nextQuery
      seededHitsRef.current = nextHits
      aiCandidatesRef.current = nextHits
      setQuery(nextQuery)
      setHits(nextHits)
      setLookupError(opts.error)
      if (opts.label) setDetectedLabel(opts.label)
      setPhase("manual")
    },
    [],
  )

  useEffect(() => {
    if (phase !== "manual") return

    const q = query.trim()
    const seeded = seededHitsRef.current
    const seedQuery = seedQueryRef.current.trim()

    if (q === seedQuery && seeded.length) {
      setHits(seeded)
      setSearchLoading(false)
      return
    }

    if (q.length < 2) {
      setHits(seeded.length ? seeded : [])
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)
    const timer = window.setTimeout(() => {
      fetch(`/api/cards/search?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data: { results?: CardSearchHit[] }) => setHits(data.results ?? []))
        .catch(() => setHits(seeded))
        .finally(() => setSearchLoading(false))
    }, 320)

    return () => window.clearTimeout(timer)
  }, [phase, query])

  const presentMatch = useCallback((entry: MockCardEntry, opts?: { openDrawer?: boolean }) => {
    const normalized = normalizeCardEntry(entry)
    presentedCardIdRef.current = normalized.id
    setCard(normalized)
    setPhase("hud")
    setDrawerOpen(opts?.openDrawer !== false)
  }, [])

  const fetchPricedCard = useCallback(async (hit: CardSearchHit): Promise<MockCardEntry> => {
    const params = hit.id.startsWith("pc-")
      ? new URLSearchParams({ id: hit.id })
      : new URLSearchParams({
          pokemonTcgId: hit.pokemonTcgId || hit.id.replace(/^poke-/, ""),
          cardName: hit.cardName,
          setName: hit.setName,
          cardNumber: hit.cardNumber,
        })
    if (!hit.id.startsWith("pc-") && hit.imageUrl) params.set("imageUrl", hit.imageUrl)
    if (hit.id.startsWith("pc-")) {
      params.set("cardName", hit.cardName)
      params.set("setName", hit.setName)
      params.set("cardNumber", hit.cardNumber)
      if (hit.pokemonTcgId) params.set("pokemonTcgId", hit.pokemonTcgId)
    }

    const res = await fetch(`/api/cards/lookup?${params.toString()}`)
    if (!res.ok) {
      return normalizeCardEntry(searchHitToPlaceholder(hit))
    }
    const data = (await res.json()) as MockCardEntry
    return normalizeCardEntry(data)
  }, [])

  const processScanResult = useCallback(
    async (json: ScanPipelineResult, snapshotUrl: string) => {
      setSnapshot(snapshotUrl)
      const label = [
        json.detected?.cardName,
        json.detected?.cardNumber ? `#${json.detected.cardNumber}` : null,
      ]
        .filter(Boolean)
        .join(" ")

      setDetectedLabel(label || null)
      aiCandidatesRef.current = json.candidates ?? []
      setMatchMeta({
        matchMethod: json.matchMethod,
        matchScore: json.matchScore,
      })

      if (json.matchMethod === "visual_phash") {
        setIdentifyStatus("Visual match — loading prices…")
      } else {
        setIdentifyStatus("Identifying — loading prices…")
      }

      if (json.card) {
        if (json.needsLiveRefresh && json.hit) {
          const hit = json.hit
          setIdentifyStatus("Loading live prices…")
          setLookupLoading(true)
          try {
            const priced = await fetchPricedCard(hit)
            presentMatch(priced, { openDrawer: true })
            setLookupError(
              priced.hasPricing === false
                ? "Matched the card, but live PriceCharting comps didn’t load."
                : null,
            )
          } finally {
            setLookupLoading(false)
          }
          return
        }

        presentMatch(normalizeCardEntry(json.card))
        if (json.card.hasPricing === false) {
          setLookupError("Matched the card, but live PriceCharting comps didn’t load.")
        }
        return
      }

      if (json.candidates?.length) {
        const top = json.candidates[0]!
        setIdentifyStatus("Loading prices…")
        setLookupLoading(true)
        try {
          const priced = await fetchPricedCard(top)
          presentMatch(priced)
        } catch {
          presentMatch(normalizeCardEntry(searchHitToPlaceholder(top)))
          setLookupError("Price lookup failed.")
        } finally {
          setLookupLoading(false)
        }
        return
      }

      enterManualHandoff({
        query: json.query || label,
        candidates: json.candidates,
        error: "Could not match this card. Search manually below.",
        label: label || null,
      })
    },
    [enterManualHandoff, fetchPricedCard, presentMatch],
  )

  const lookupHit = async (hit: CardSearchHit) => {
    const refreshGen = ++priceRefreshGenRef.current
    setLookupLoading(true)
    setLookupError(null)
    presentMatch(searchHitToPlaceholder(hit))
    try {
      const priced = await fetchPricedCard(hit)
      if (priceRefreshGenRef.current !== refreshGen) return
      presentMatch(priced, { openDrawer: true })
      if (priced.hasPricing === false) {
        setLookupError("Catalog match loaded, but live PriceCharting comps are missing for this card.")
      }
    } catch {
      if (priceRefreshGenRef.current !== refreshGen) return
      setCard(normalizeCardEntry(searchHitToPlaceholder(hit)))
      setLookupError("Price lookup failed — showing the catalog match without live comps.")
    } finally {
      if (priceRefreshGenRef.current === refreshGen) setLookupLoading(false)
    }
  }

  const resetScan = () => {
    priceRefreshGenRef.current += 1
    presentedCardIdRef.current = null
    seededHitsRef.current = []
    seedQueryRef.current = ""
    aiCandidatesRef.current = []
    setIsScanning(false)
    setSnapshot(null)
    setCard(null)
    setHits([])
    setQuery("")
    setLookupError(null)
    setDetectedLabel(null)
    setDrawerOpen(false)
    setMatchMeta(null)
    setPhase("camera")
  }

  const showWrongCardPicker = () => {
    enterManualHandoff({
      query: detectedLabel?.replace(/#/g, "") || card?.cardName || "",
      candidates: aiCandidatesRef.current,
      error: "Pick a different catalog match.",
      label: detectedLabel,
    })
    setCard(null)
    setDrawerOpen(false)
  }

  const best = card ? getBestGradeQuote(getGradeQuotes(card)) : null
  const quotes = card ? getGradeQuotes(card) : []
  const labPsa10 = card ? resolvePsa10Price(card).price : 0
  const labPsa9 = card ? (getGradeQuotes(card).find((q) => q.grade === 9)?.slabPrice ?? 0) : 0
  const labGradingCost = DEFAULT_PSA_GRADING_FEE
  const labGross = labPsa10 - (card?.rawPrice ?? 0)
  const labNet = labGross - labGradingCost
  const labMult = card && card.rawPrice > 0 ? labPsa10 / card.rawPrice : 0
  const labReady = labPsa10 > 0 && (card?.rawPrice ?? 0) > 0 && labPsa10 > (card?.rawPrice ?? 0)

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-black text-white">
      <header className="relative z-40 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-zinc-950 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={backHref}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80"
            aria-label={`Back to ${tool === "slablab" ? "SlabLab" : "SlabCrack"}`}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <CollecToolsBrand href="/" size="sm" subtitle={toolLabel} className="min-w-0" />
        </div>
        <SiteAuthButton className="shrink-0" />
      </header>

      <div className="flex shrink-0 justify-end border-b border-white/10 bg-zinc-950 px-4 py-2">
        <Link
          href={multiScanHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-white/80 hover:bg-white/10"
        >
          <Layers className="size-3.5 text-primary" />
          Multi-card (1–9)
        </Link>
      </div>

      <div className="relative z-0 min-h-0 flex-1 overflow-hidden bg-zinc-950">
        {phase === "camera" || isScanning ? (
          <CardScanner
            autoScan
            scanning={isScanning}
            processingMessage={identifyStatus}
            onScanStart={() => {
              setIsScanning(true)
              setIdentifyStatus("Scanning card…")
              setLookupError(null)
              setDetectedLabel(null)
              setCard(null)
              presentedCardIdRef.current = null
              seededHitsRef.current = []
              seedQueryRef.current = ""
              aiCandidatesRef.current = []
            }}
            onScanComplete={(result, snap) => {
              void processScanResult(result, snap).finally(() => setIsScanning(false))
            }}
            onScanFail={(error, snap) => {
              if (snap) setSnapshot(snap)
              setIsScanning(false)
              enterManualHandoff({ query: "", error })
            }}
            className="absolute inset-0 size-full rounded-none border-0"
            immersive
          />
        ) : snapshot ? (
          <div className="relative size-full">
            <Image src={snapshot} alt="Captured card" fill className="object-cover" unoptimized priority />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/60">No snapshot</div>
        )}

        {phase === "hud" && card && !isScanning ? (
          <div className="absolute inset-x-0 bottom-0 z-20 space-y-3 bg-gradient-to-t from-black via-black/95 to-transparent px-4 pb-5 pt-14">
            <div className="rounded-2xl border border-white/15 bg-black/70 p-3 backdrop-blur-md">
              {detectedLabel ? (
                <p className="mb-2 text-[11px] font-medium text-primary">Match · {detectedLabel}</p>
              ) : null}
              {lookupError ? (
                <p className="mb-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-[11px] text-amber-100">
                  {lookupError}
                </p>
              ) : null}
              {lookupLoading ? (
                <p className="mb-2 flex items-center gap-1.5 text-[11px] text-white/60">
                  <Loader2 className="size-3 animate-spin" />
                  Loading live prices…
                </p>
              ) : (
                <ScanMatchFeedback
                  key={card.id}
                  scanMode="single"
                  cardId={card.id}
                  cardName={card.cardName}
                  setName={card.setName}
                  cardNumber={card.cardNumber}
                  matchMethod={matchMeta?.matchMethod}
                  matchScore={matchMeta?.matchScore}
                  onWrong={showWrongCardPicker}
                  className="mb-3"
                />
              )}
              <div className="flex items-start gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                  {card.imageUrl ? (
                    <Image src={card.imageUrl} alt="" fill className="object-cover" unoptimized />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{card.cardName}</p>
                  <p className="truncate text-xs text-white/60">
                    {card.setName}
                    {card.cardNumber ? ` · #${card.cardNumber}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-xs text-white">
                      Raw {formatMoney(card.rawPrice)}
                    </span>
                    {best?.isArbitrage ? (
                      <DeficitBadge diff={best.deficit} pct={best.percentageSavings} size="sm" />
                    ) : null}
                    <span className="rounded-md border border-primary/40 bg-primary/15 px-2 py-1 font-mono text-xs text-primary">
                      PSA 10 {formatMoney(labPsa10)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  SlabCrack · PSA 7–9
                </p>
                <GradePriceGrid quotes={quotes} priced={card.hasPricing !== false} compact />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="col-span-3 -mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  SlabLab · PSA 10
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">Gross</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-white">
                    {formatSigned(labGross)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">Net ROI</p>
                  <p
                    className={cn(
                      "mt-0.5 font-mono text-sm font-semibold",
                      labNet >= 0 ? "text-primary" : "text-amber-300",
                    )}
                  >
                    {formatSigned(labNet)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">Mult</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-white">
                    {labMult > 0 ? `${labMult.toFixed(2)}×` : "—"}
                  </p>
                </div>
                <p className="col-span-3 text-[10px] text-white/45">
                  Net uses PSA Regular grading fee ({formatMoney(labGradingCost)}). PSA 9{" "}
                  {formatMoney(labPsa9)}.
                  {!labReady ? " Pricing may be incomplete if PSA 10 comps are thin." : ""}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                >
                  Full Crack + Lab data
                </button>
                <Link
                  href={tool === "slablab" ? "/slablab" : "/slabcrack"}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-3 text-sm font-medium text-white"
                >
                  {tool === "slablab" ? "Board" : "Feed"}
                </Link>
                <button
                  type="button"
                  onClick={showWrongCardPicker}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-3 text-sm font-medium text-white"
                >
                  Wrong card
                </button>
                <button
                  type="button"
                  onClick={resetScan}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-3 text-sm font-medium text-white"
                >
                  <RefreshCw className="size-3.5" />
                  Rescan
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {phase === "manual" ? (
        <div className="relative z-40 flex max-h-[50vh] shrink-0 flex-col border-t border-white/10 bg-zinc-950">
          <div className="flex items-center justify-between px-4 pt-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ScanLine className="size-4 text-primary" />
              Confirm card
            </div>
            <button
              type="button"
              onClick={resetScan}
              className="flex size-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
              aria-label="Cancel"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="px-4 pt-1 text-xs text-white/55">
            Auto-detect needed a handoff — pick the right card (or edit the search).
          </p>

          <div className="relative px-4 pt-3">
            <Search className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Card name, set, or number…"
              className="h-11 w-full rounded-xl border border-white/15 bg-white/5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-primary/50"
            />
          </div>

          {lookupError ? (
            <p className="mx-4 mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
              {lookupError}
            </p>
          ) : null}

          <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {searchLoading || lookupLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-white/60">
                <Loader2 className="size-4 animate-spin" />
                {lookupLoading ? "Loading prices…" : "Searching…"}
              </div>
            ) : query.trim().length < 2 ? (
              <p className="px-2 py-6 text-center text-xs text-white/45">Enter at least 2 characters</p>
            ) : hits.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-white/45">No matches — try name + number</p>
            ) : (
              <ul className="space-y-1">
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      disabled={lookupLoading}
                      onClick={() => void lookupHit(hit)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/8 disabled:opacity-60"
                    >
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-white/10 bg-zinc-900">
                        {hit.imageUrl ? (
                          <Image src={hit.imageUrl} alt="" fill className="object-cover" unoptimized />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{hit.cardName}</p>
                        <p className="truncate text-xs text-white/50">
                          {hit.setName}
                          {hit.cardNumber ? ` · #${hit.cardNumber}` : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {drawerOpen && card ? (
        <SlabDrawer
          selectedCard={card}
          watched={false}
          focus="both"
          onClose={() => setDrawerOpen(false)}
          onToggleWatch={() => {}}
        />
      ) : null}
    </div>
  )
}
