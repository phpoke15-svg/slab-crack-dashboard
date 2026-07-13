"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  Loader2,
  RefreshCw,
  Search,
  ScanLine,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CollecToolsBrand } from "@/components/collectools-brand"
import { SiteAuthButton } from "@/components/site-auth-button"
import { DeficitBadge } from "@/components/deficit-badge"
import { GradePriceGrid } from "@/components/grade-price-grid"
import { SlabDrawer } from "@/components/slab-drawer"
import { searchHitToPlaceholder, type CardSearchHit } from "@/lib/card-lookup"
import {
  getBestGradeQuote,
  getGradeQuotes,
  normalizeCardEntry,
  type MockCardEntry,
} from "@/lib/slab-data"

type Phase = "camera" | "identify" | "hud"

function formatMoney(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—"
  return `$${n.toFixed(2)}`
}

export function SlabcrackScanClient() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [phase, setPhase] = useState<Phase>("camera")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [snapshot, setSnapshot] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<CardSearchHit[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const [card, setCard] = useState<MockCardEntry | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setCameraReady(false)
    stopCamera()

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera not supported in this browser. Upload a photo instead.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      setCameraReady(true)
    } catch {
      setCameraError("Could not open the camera. Check permissions, or upload a photo.")
    }
  }, [stopCamera])

  useEffect(() => {
    if (phase !== "camera") {
      stopCamera()
      return
    }
    void startCamera()
    return () => stopCamera()
  }, [phase, startCamera, stopCamera])

  useEffect(() => {
    const q = query.trim()
    if (phase !== "identify" || q.length < 2) {
      setHits([])
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)
    const timer = window.setTimeout(() => {
      fetch(`/api/cards/search?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data: { results?: CardSearchHit[] }) => setHits(data.results ?? []))
        .catch(() => setHits([]))
        .finally(() => setSearchLoading(false))
    }, 320)

    return () => window.clearTimeout(timer)
  }, [phase, query])

  const captureFrame = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !cameraReady) return

    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88)
    setSnapshot(dataUrl)
    setPhase("identify")
    setQuery("")
    setHits([])
    setCard(null)
    setLookupError(null)
  }

  const onPickFile = async (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setSnapshot(String(reader.result))
      setPhase("identify")
      setQuery("")
      setHits([])
      setCard(null)
      setLookupError(null)
    }
    reader.readAsDataURL(file)
  }

  const lookupHit = async (hit: CardSearchHit) => {
    setLookupLoading(true)
    setLookupError(null)
    setCard(searchHitToPlaceholder(hit))
    try {
      const params = hit.id.startsWith("pc-")
        ? new URLSearchParams({ id: hit.id })
        : new URLSearchParams({
            pokemonTcgId: hit.pokemonTcgId,
            cardName: hit.cardName,
            setName: hit.setName,
            cardNumber: hit.cardNumber,
          })
      if (!hit.id.startsWith("pc-") && hit.imageUrl) params.set("imageUrl", hit.imageUrl)

      const res = await fetch(`/api/cards/lookup?${params.toString()}`)
      if (!res.ok) {
        setCard(normalizeCardEntry(searchHitToPlaceholder(hit)))
        setPhase("hud")
        return
      }
      const data = (await res.json()) as MockCardEntry
      setCard(normalizeCardEntry(data))
      setPhase("hud")
    } catch {
      setLookupError("Price lookup failed. Try another match.")
      setCard(null)
    } finally {
      setLookupLoading(false)
    }
  }

  const resetScan = () => {
    setSnapshot(null)
    setCard(null)
    setHits([])
    setQuery("")
    setLookupError(null)
    setDrawerOpen(false)
    setPhase("camera")
  }

  const best = card ? getBestGradeQuote(getGradeQuotes(card)) : null
  const quotes = card ? getGradeQuotes(card) : []

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-black text-white">
      <canvas ref={canvasRef} className="hidden" aria-hidden />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
      />

      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 pb-8 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/slabcrack"
            className="flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 backdrop-blur"
            aria-label="Back to SlabCrack"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <CollecToolsBrand href="/" size="sm" subtitle="SlabCrack Scan" className="min-w-0" />
        </div>
        <SiteAuthButton className="shrink-0" />
      </header>

      {/* Camera / snapshot stage */}
      <div className="relative flex-1 overflow-hidden bg-zinc-950">
        {phase === "camera" ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 size-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
            <div className="pointer-events-none absolute inset-x-[12%] top-[18%] bottom-[28%] rounded-[1.5rem] border-2 border-primary/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            <div className="pointer-events-none absolute inset-x-0 top-[18%] flex justify-center">
              <span className="rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
                Line up the card face
              </span>
            </div>
          </>
        ) : snapshot ? (
          <Image src={snapshot} alt="Captured card" fill className="object-cover" unoptimized priority />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/60">No snapshot</div>
        )}

        {/* HUD overlay */}
        {phase === "hud" && card ? (
          <div className="absolute inset-x-0 bottom-0 z-20 space-y-3 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pb-6 pt-16">
            <div className="rounded-2xl border border-white/15 bg-black/55 p-3 backdrop-blur-md">
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
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <GradePriceGrid quotes={quotes} priced={card.hasPricing !== false} compact />
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                >
                  Full SlabCrack data
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

      {/* Identify sheet */}
      {phase === "identify" ? (
        <div className="absolute inset-x-0 bottom-0 z-30 max-h-[55vh] overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 pt-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ScanLine className="size-4 text-primary" />
              Identify card
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
            Type the name and number (e.g. Umbreon 161). We’ll pull live SlabCrack prices.
          </p>

          <div className="relative px-4 pt-3">
            <Search className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              placeholder="Card name, set, or number…"
              className="h-11 w-full rounded-xl border border-white/15 bg-white/5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-primary/50"
            />
          </div>

          {lookupError ? (
            <p className="mx-4 mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {lookupError}
            </p>
          ) : null}

          <div className="mt-2 max-h-[32vh] overflow-y-auto px-2 pb-4">
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

      {/* Camera controls */}
      {phase === "camera" ? (
        <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-8 pt-10">
          {cameraError ? (
            <p className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-center text-xs text-amber-100">
              {cameraError}
            </p>
          ) : null}
          <div className="flex items-center justify-center gap-8">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white"
              aria-label="Upload photo"
            >
              <ImagePlus className="size-5" />
            </button>
            <button
              type="button"
              onClick={captureFrame}
              disabled={!cameraReady}
              className="flex size-[4.5rem] items-center justify-center rounded-full border-4 border-white/90 bg-white text-black shadow-lg disabled:opacity-40"
              aria-label="Capture card"
            >
              <Camera className="size-7" />
            </button>
            <button
              type="button"
              onClick={() => void startCamera()}
              className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white"
              aria-label="Retry camera"
            >
              <RefreshCw className="size-5" />
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] text-white/50">
            Snap → identify → live raw vs PSA prices
          </p>
        </div>
      ) : null}

      {drawerOpen && card ? (
        <SlabDrawer
          selectedCard={card}
          watched={false}
          onClose={() => setDrawerOpen(false)}
          onToggleWatch={() => {}}
        />
      ) : null}
    </div>
  )
}
