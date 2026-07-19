"use client"

import { useCallback, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Layers, Loader2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { DeficitBadge } from "@/components/deficit-badge"
import { MultiCardScanner } from "@/components/multi-card-scanner"
import { ScanMatchFeedback } from "@/components/scan-match-feedback"
import { SlabDrawer } from "@/components/slab-drawer"
import { searchHitToPlaceholder, type CardSearchHit } from "@/lib/card-lookup"
import type { BatchScanResult } from "@/lib/scanner/types"
import {
  getBestGradeQuote,
  getGradeQuotes,
  normalizeCardEntry,
  resolvePsa10Price,
  type MockCardEntry,
} from "@/lib/slab-data"

import {
  isSlabItTool,
  slabLabsMultiScanHref,
  slabLabsScanBackHref,
  slabLabsScanHref,
  type SlabLabsScanTool,
} from "@/lib/slabs-labs-routes"

type ScanTool = SlabLabsScanTool | "slablab"
type Phase = "camera" | "results"

type ResultRow = {
  index: number
  card: MockCardEntry | null
  error?: string
  loading?: boolean
  matchMethod?: "visual_phash" | "vision"
  matchScore?: number
}

function formatMoney(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—"
  return `$${n.toFixed(2)}`
}

export function MultiCardScanClient({ tool = "slabcrack" }: { tool?: ScanTool }) {
  const backHref = slabLabsScanBackHref(tool)
  const singleScanHref = slabLabsScanHref(tool)
  const toolLabel = isSlabItTool(tool) ? "SlabIt Multi-Scan" : "SlabCrack Multi-Scan"

  const refreshGenRef = useRef(0)

  const [phase, setPhase] = useState<Phase>("camera")
  const [isScanning, setIsScanning] = useState(false)
  const [status, setStatus] = useState("Scanning…")
  const [scanError, setScanError] = useState<string | null>(null)
  const [frame, setFrame] = useState<string | null>(null)
  const [rows, setRows] = useState<ResultRow[]>([])
  const [drawerCard, setDrawerCard] = useState<MockCardEntry | null>(null)

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
    if (!res.ok) return normalizeCardEntry(searchHitToPlaceholder(hit))
    return normalizeCardEntry((await res.json()) as MockCardEntry)
  }, [])

  const processBatch = useCallback(
    async (batch: BatchScanResult) => {
      const initial: ResultRow[] = batch.cards.map((slot) => {
        if (!slot.ok || !slot.result) {
          return { index: slot.index, card: null, error: slot.error || "Unidentified" }
        }
        const r = slot.result
        const meta = { matchMethod: r.matchMethod, matchScore: r.matchScore }
        if (r.card) {
          return {
            index: slot.index,
            card: normalizeCardEntry(r.card),
            loading: r.needsLiveRefresh,
            ...meta,
          }
        }
        if (r.candidates?.length) {
          return {
            index: slot.index,
            card: normalizeCardEntry(searchHitToPlaceholder(r.candidates[0]!)),
            loading: true,
            ...meta,
          }
        }
        return { index: slot.index, card: null, error: "No catalog match", ...meta }
      })

      setRows(initial)
      setPhase("results")

      const refreshGen = ++refreshGenRef.current

      await Promise.all(
        batch.cards.map(async (slot, i) => {
          if (!slot.ok || !slot.result) return
          const r = slot.result

          try {
            if (r.needsLiveRefresh && r.hit) {
              const priced = await fetchPricedCard(r.hit)
              if (refreshGenRef.current !== refreshGen) return
              setRows((prev) =>
                prev.map((row, idx) =>
                  idx === i ? { ...row, card: priced, loading: false } : row,
                ),
              )
              return
            }

            if (!r.card && r.candidates?.length) {
              const priced = await fetchPricedCard(r.candidates[0]!)
              if (refreshGenRef.current !== refreshGen) return
              setRows((prev) =>
                prev.map((row, idx) =>
                  idx === i ? { ...row, card: priced, loading: false } : row,
                ),
              )
            } else if (r.card) {
              setRows((prev) =>
                prev.map((row, idx) => (idx === i ? { ...row, loading: false } : row)),
              )
            }
          } catch {
            if (refreshGenRef.current !== refreshGen) return
            setRows((prev) =>
              prev.map((row, idx) =>
                idx === i ? { ...row, loading: false, error: row.error || "Price lookup failed" } : row,
              ),
            )
          }
        }),
      )
    },
    [fetchPricedCard],
  )

  const resetScan = () => {
    refreshGenRef.current += 1
    setIsScanning(false)
    setFrame(null)
    setRows([])
    setDrawerCard(null)
    setPhase("camera")
    setStatus("Scanning…")
    setScanError(null)
  }

  const identified = rows.filter((r) => r.card).length

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

      <div className="relative z-0 min-h-0 flex-1 overflow-hidden bg-zinc-950">
        {phase === "camera" || isScanning ? (
          <MultiCardScanner
            autoScan
            scanning={isScanning}
            processingMessage={status}
            onScanStart={() => {
              setIsScanning(true)
              setScanError(null)
              setStatus("Scanning page…")
              setRows([])
            }}
            onScanProgress={setStatus}
            onScanComplete={(batch, snap) => {
              setFrame(snap)
              setScanError(null)
              void processBatch(batch).finally(() => setIsScanning(false))
            }}
            onScanFail={(error, snap) => {
              if (snap) setFrame(snap)
              setIsScanning(false)
              setScanError(error)
            }}
            className="absolute inset-0 size-full rounded-none border-0"
            immersive
          />
        ) : frame ? (
          <div className="relative h-40 shrink-0 border-b border-white/10">
            <Image src={frame} alt="Scanned frame" fill className="object-cover" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
            <p className="absolute bottom-2 left-4 text-xs font-medium text-white/80">
              {identified} of {rows.length} identified
            </p>
          </div>
        ) : null}

        {phase === "results" && !isScanning ? (
          <div
            className={cn(
              "overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3",
              frame ? "max-h-[calc(100%-10rem)]" : "h-full",
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Layers className="size-4 text-primary" />
                {rows.length} card{rows.length === 1 ? "" : "s"} found
              </div>
              <button
                type="button"
                onClick={resetScan}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white"
              >
                <RefreshCw className="size-3.5" />
                Rescan
              </button>
            </div>

            {rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/50">No results — try again</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {rows.map((row) => {
                  const card = row.card
                  const best = card ? getBestGradeQuote(getGradeQuotes(card)) : null
                  const psa10 = card ? resolvePsa10Price(card).price : 0

                  return (
                    <li key={row.index}>
                      <div
                        className={cn(
                          "flex w-full flex-col rounded-xl border border-white/10 bg-white/5 p-2",
                          card ? "" : "opacity-60",
                        )}
                      >
                        <button
                          type="button"
                          disabled={!card}
                          onClick={() => card && setDrawerCard(card)}
                          className={cn(
                            "flex w-full flex-col text-left",
                            card ? "hover:opacity-95" : "",
                          )}
                        >
                        <div className="relative mb-2 aspect-[63/88] w-full overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                          {card?.imageUrl ? (
                            <Image
                              src={card.imageUrl}
                              alt=""
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-white/40">
                              ?
                            </div>
                          )}
                          {row.loading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <Loader2 className="size-5 animate-spin text-primary" />
                            </div>
                          ) : null}
                        </div>
                        {card ? (
                          <>
                            <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-white">
                              {card.cardName}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-white/50">
                              {card.setName}
                              {card.cardNumber ? ` · #${card.cardNumber}` : ""}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white">
                                {formatMoney(card.rawPrice)}
                              </span>
                              <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                                10 {formatMoney(psa10)}
                              </span>
                            </div>
                            {best?.isArbitrage ? (
                              <div className="mt-1">
                                <DeficitBadge diff={best.deficit} pct={best.percentageSavings} size="sm" />
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-[11px] text-amber-200">{row.error || "Unknown"}</p>
                        )}
                        </button>
                        {card && !row.loading ? (
                          <ScanMatchFeedback
                            key={`${row.index}-${card.id}`}
                            scanMode="multi"
                            cardId={card.id}
                            cardName={card.cardName}
                            setName={card.setName}
                            cardNumber={card.cardNumber}
                            matchMethod={row.matchMethod}
                            matchScore={row.matchScore}
                            batchIndex={row.index}
                            compact
                            className="mt-2 border-t border-white/10 pt-2"
                          />
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={singleScanHref}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-sm font-medium text-white"
              >
                Single-card scan
              </Link>
              <Link
                href={backHref}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-medium text-white"
              >
                {tool === "slablab" ? "Board" : "Feed"}
              </Link>
            </div>
          </div>
        ) : null}

        {scanError && phase === "camera" && !isScanning ? (
          <div className="absolute inset-x-4 bottom-24 z-30 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-center text-xs text-amber-100">
            {scanError}
          </div>
        ) : null}
      </div>

      {drawerCard ? (
        <SlabDrawer
          selectedCard={drawerCard}
          watched={false}
          focus="both"
          onClose={() => setDrawerCard(null)}
          onToggleWatch={() => {}}
        />
      ) : null}
    </div>
  )
}
