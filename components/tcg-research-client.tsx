"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Camera,
  Loader2,
  Search,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { SiteFooter } from "@/components/legal/site-footer"
import { CardSearchResults } from "@/components/card-search-results"
import { PriceHistoryChart } from "@/components/price-history-chart"
import { SlabCardImage } from "@/components/slab-card-image"
import type { CardSearchHit } from "@/lib/card-lookup"
import type { TcgResearchCardDetail } from "@/lib/tcg-research/card-detail"
import type { TcgGame } from "@/lib/scrydex/types"

const GAME_TABS: { id: TcgGame; label: string }[] = [
  { id: "pokemon", label: "Pokémon" },
  { id: "lorcana", label: "Lorcana" },
  { id: "mtg", label: "MTG" },
]

function money(value: number | null | undefined): string {
  if (value == null || value <= 0) return "—"
  return value >= 100 ? `$${value.toFixed(0)}` : `$${value.toFixed(2)}`
}

function TrendBadge({ trend }: { trend: TcgResearchCardDetail["priceTrend"] }) {
  if (trend === "up") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
        <TrendingUp className="size-3" /> Strong spread
      </span>
    )
  }
  if (trend === "down") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
        <TrendingDown className="size-3" /> Tight spread
      </span>
    )
  }
  if (trend === "flat") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        <Minus className="size-3" /> Stable
      </span>
    )
  }
  return null
}

function useTcgResearchSearch(query: string, game: TcgGame, enabled: boolean) {
  const [hits, setHits] = useState<CardSearchHit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || query.trim().length < 2) {
      setHits([])
      setError(null)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setIsLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ q: query.trim(), game })
        const res = await fetch(`/api/tcg-research/search?${params.toString()}`, {
          signal: controller.signal,
        })
        const json = (await res.json()) as { results?: CardSearchHit[]; error?: string }
        if (!res.ok) throw new Error(json.error || "Search failed")
        setHits(json.results ?? [])
      } catch (err) {
        if (controller.signal.aborted) return
        setHits([])
        setError(err instanceof Error ? err.message : "Search failed")
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [enabled, game, query])

  return { hits, isLoading, error }
}

export function TcgResearchClient() {
  const [game, setGame] = useState<TcgGame>("pokemon")
  const [query, setQuery] = useState("")
  const [selectedHit, setSelectedHit] = useState<CardSearchHit | null>(null)
  const [detail, setDetail] = useState<TcgResearchCardDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [scanBusy, setScanBusy] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const searchEnabled = query.trim().length >= 2
  const { hits, isLoading, error: searchError } = useTcgResearchSearch(query, game, searchEnabled)

  const loadDetail = useCallback(async (hit: CardSearchHit) => {
    setSelectedHit(hit)
    setDetailLoading(true)
    try {
      const params = new URLSearchParams({ id: hit.id, game })
      const res = await fetch(`/api/tcg-research/card?${params.toString()}`)
      const json = (await res.json()) as { card?: TcgResearchCardDetail; error?: string }
      if (!res.ok || !json.card) throw new Error(json.error || "Could not load card")
      setDetail(json.card)
    } catch {
      setDetail({
        id: hit.id,
        catalogId: null,
        scrydexId: hit.pokemonTcgId,
        game,
        name: hit.cardName,
        setName: hit.setName,
        setId: "",
        number: hit.cardNumber,
        rarity: hit.rarity,
        imageUrl: hit.imageUrl,
        rawPrice: hit.rawPrice ?? null,
        psa7Price: null,
        psa8Price: null,
        psa9Price: null,
        psa10Price: null,
        priceUpdatedAt: null,
        priceTrend: null,
      })
    } finally {
      setDetailLoading(false)
    }
  }, [game])

  const loadFromVision = useCallback(async (imageBase64: string) => {
    setScanBusy(true)
    setScanError(null)
    try {
      const res = await fetch("/api/catalog/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, preferredGames: [game] }),
      })
      const json = (await res.json()) as {
        card?: { catalog_id?: string; scrydex_id?: string; name?: string }
        error?: string
      }
      if (!res.ok || !json.card?.scrydex_id) {
        throw new Error(json.error || "No card match from vision scan")
      }

      const lookupParams = new URLSearchParams({
        scrydexId: json.card.scrydex_id,
        game,
      })
      if (json.card.catalog_id) lookupParams.set("catalogId", json.card.catalog_id)

      const lookupRes = await fetch(`/api/tcg-research/card?${lookupParams.toString()}`)
      const lookupJson = (await lookupRes.json()) as { card?: TcgResearchCardDetail; error?: string }
      if (!lookupRes.ok || !lookupJson.card) {
        throw new Error(lookupJson.error || "Local card lookup failed")
      }

      setDetail(lookupJson.card)
      setSelectedHit({
        id: lookupJson.card.id,
        pokemonTcgId: lookupJson.card.scrydexId ?? lookupJson.card.id.replace(/^poke-/, ""),
        cardName: lookupJson.card.name,
        setName: lookupJson.card.setName,
        cardNumber: lookupJson.card.number,
        imageUrl: lookupJson.card.imageUrl,
        rarity: lookupJson.card.rarity,
        rawPrice: lookupJson.card.rawPrice ?? undefined,
      })
      setScanOpen(false)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Vision scan failed")
    } finally {
      setScanBusy(false)
    }
  }, [game])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setScanError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setScanError("Camera access denied. Upload a photo instead.")
    }
  }, [])

  useEffect(() => {
    if (scanOpen) void startCamera()
    return () => stopCamera()
  }, [scanOpen, startCamera, stopCamera])

  const captureAndScan = useCallback(async () => {
    const video = videoRef.current
    if (!video || video.videoWidth <= 0) return

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88)
    const base64 = dataUrl.split(",")[1]
    if (base64) await loadFromVision(base64)
  }, [loadFromVision])

  const handleFileUpload = useCallback(
    async (file: File | null) => {
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const result = String(reader.result ?? "")
        const base64 = result.includes(",") ? result.split(",")[1] : result
        if (base64) void loadFromVision(base64)
      }
      reader.readAsDataURL(file)
    },
    [loadFromVision],
  )

  const gradeSpreads = useMemo(() => {
    if (!detail) return []
    return [
      { label: "Raw NM", value: detail.rawPrice },
      { label: "PSA 7", value: detail.psa7Price },
      { label: "PSA 8", value: detail.psa8Price },
      { label: "PSA 9", value: detail.psa9Price },
      { label: "PSA 10", value: detail.psa10Price },
    ].filter((row) => row.value != null && row.value > 0)
  }, [detail])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <CollecToolsBrand href="/" size="lg" subtitle="TCG Research · catalog + market analytics" />
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Unlimited hybrid search across Pokémon, Lorcana, and MTG with local prices, grade spreads,
            price history, and Scrydex Vision scanning.
          </p>
        </div>
        <SiteAuthButton className="shrink-0" />
      </header>

      <section className="rounded-2xl border border-border bg-card/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border bg-secondary/40 p-0.5" role="tablist">
            {GAME_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={game === tab.id}
                onClick={() => {
                  setGame(tab.id)
                  setSelectedHit(null)
                  setDetail(null)
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
                  game === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 sm:text-sm"
          >
            <Camera className="size-4" />
            Scan card
          </button>
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, set, or collector number…"
            className={cn(
              "h-11 w-full rounded-xl border border-border bg-secondary/60 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground",
              "outline-none transition-colors focus:border-primary/50 focus:bg-secondary",
            )}
          />
        </div>

        {searchError ? (
          <p className="mt-3 text-sm text-destructive">{searchError}</p>
        ) : null}

        {searchEnabled ? (
          <div className="mt-4">
            <CardSearchResults
              hits={hits}
              loading={isLoading}
              query={query}
              watchedIds={[]}
              isHitWatched={() => false}
              onSelect={(hit) => void loadDetail(hit)}
              onToggleWatch={() => {}}
              detailLoadingId={detailLoading ? selectedHit?.id ?? null : null}
            />
          </div>
        ) : null}
      </section>

      {detail ? (
        <section className="grid gap-4 rounded-2xl border border-border bg-card/50 p-4 sm:grid-cols-[minmax(0,220px)_1fr] sm:p-5">
          <div className="mx-auto w-full max-w-[220px]">
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/10 bg-muted/30">
              <SlabCardImage
                card={{
                  id: detail.id,
                  cardName: detail.name,
                  setName: detail.setName,
                  imageUrl: detail.imageUrl,
                  cardNumber: detail.number,
                }}
                alt={detail.name}
                sizes="220px"
                className="object-contain p-2"
              />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{detail.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {detail.setName} · #{detail.number}
                  {detail.rarity ? ` · ${detail.rarity}` : ""}
                </p>
              </div>
              <TrendBadge trend={detail.priceTrend} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {gradeSpreads.length > 0 ? (
                gradeSpreads.map((row) => (
                  <div key={row.label} className="rounded-xl border border-border bg-background/60 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {row.label}
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
                      {money(row.value)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="col-span-full text-sm text-muted-foreground">
                  No local prices yet — prices refresh via Scrydex on-demand sync.
                </p>
              )}
            </div>

            <div className="mt-5">
              <PriceHistoryChart
                cardId={detail.id}
                grade={10}
                currentRaw={detail.rawPrice ?? undefined}
                currentSlab={detail.psa10Price ?? undefined}
                days={90}
              />
            </div>
          </div>
        </section>
      ) : null}

      {scanOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-background p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Scrydex Vision scan</h3>
              <button
                type="button"
                onClick={() => setScanOpen(false)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>

            <div className="relative mt-3 overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} className="aspect-[3/4] w-full object-cover" playsInline muted />
              {scanBusy ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="size-8 animate-spin text-primary" />
                </div>
              ) : null}
            </div>

            {scanError ? <p className="mt-3 text-sm text-destructive">{scanError}</p> : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={scanBusy}
                onClick={() => void captureAndScan()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {scanBusy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                Capture & identify
              </button>
              <button
                type="button"
                disabled={scanBusy}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground"
              >
                Upload photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => void handleFileUpload(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <SiteFooter />
    </div>
  )
}
