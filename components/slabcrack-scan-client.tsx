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

type Phase = "camera" | "identifying" | "manual" | "hud"

type IdentifyResponse = {
  ok?: boolean
  error?: string
  detected?: {
    cardName: string
    setName: string
    cardNumber: string
    confidence: number
    notes?: string
  }
  query?: string
  hit?: CardSearchHit | null
  candidates?: CardSearchHit[]
  card?: MockCardEntry | null
}

function formatMoney(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—"
  return `$${n.toFixed(2)}`
}

/** Downscale/compress camera photos so vision API stays fast + under body limits. */
async function compressImageDataUrl(dataUrl: string, maxEdge = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL("image/jpeg", quality))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export function SlabcrackScanClient() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [phase, setPhase] = useState<Phase>("camera")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
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

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setCameraStarting(true)
    setCameraReady(false)
    stopCamera()

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setCameraError("Camera needs HTTPS. Use Take photo / Upload instead.")
      setCameraStarting(false)
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Live camera isn’t available here. Use Take photo or Upload.")
      setCameraStarting(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        setCameraError("Camera preview failed to load.")
        stream.getTracks().forEach((t) => t.stop())
        setCameraStarting(false)
        return
      }
      video.srcObject = stream
      video.setAttribute("playsinline", "true")
      video.muted = true
      await video.play()
      setCameraReady(true)
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ""
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraError("Camera permission blocked. Use Take photo instead, or allow camera in settings.")
      } else {
        setCameraError("Could not open live camera. Use Take photo or Upload.")
      }
    } finally {
      setCameraStarting(false)
    }
  }, [stopCamera])

  useEffect(() => {
    if (phase !== "camera") {
      stopCamera()
    }
    return () => stopCamera()
  }, [phase, stopCamera])

  useEffect(() => {
    const q = query.trim()
    if (phase !== "manual" || q.length < 2) {
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

  const autoIdentify = useCallback(async (dataUrl: string) => {
    setPhase("identifying")
    setIdentifyStatus("Detecting card with AI…")
    setLookupError(null)
    setDetectedLabel(null)
    setCard(null)

    try {
      const compressed = await compressImageDataUrl(dataUrl)
      setIdentifyStatus("Matching catalog + pulling prices…")
      const res = await fetch("/api/slabcrack/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: compressed }),
      })
      const json = (await res.json().catch(() => null)) as IdentifyResponse | null

      if (!res.ok || !json?.ok) {
        const message = json?.error || "Could not identify this card automatically."
        setLookupError(message)
        setQuery(json?.query || json?.detected?.cardName || "")
        if (json?.candidates?.length) setHits(json.candidates)
        setPhase("manual")
        return
      }

      const label = [json.detected?.cardName, json.detected?.cardNumber ? `#${json.detected.cardNumber}` : null]
        .filter(Boolean)
        .join(" ")
      setDetectedLabel(label || null)

      if (json.card) {
        setCard(normalizeCardEntry(json.card))
        setPhase("hud")
        return
      }

      setQuery(json.query || label || "")
      setHits(json.candidates ?? [])
      setLookupError("Detected the card but couldn’t load prices. Pick a match below.")
      setPhase("manual")
    } catch {
      setLookupError("Identification failed. Search manually below.")
      setPhase("manual")
    }
  }, [])

  const goIdentify = (dataUrl: string) => {
    setSnapshot(dataUrl)
    void autoIdentify(dataUrl)
  }

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
    goIdentify(canvas.toDataURL("image/jpeg", 0.88))
  }

  const onPickFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => goIdentify(String(reader.result))
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
    setDetectedLabel(null)
    setDrawerOpen(false)
    setCameraError(null)
    setPhase("camera")
  }

  const best = card ? getBestGradeQuote(getGradeQuotes(card)) : null
  const quotes = card ? getGradeQuotes(card) : []

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-black text-white">
      <canvas ref={canvasRef} className="hidden" aria-hidden />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onPickFile(e.target.files?.[0] ?? null)
          e.target.value = ""
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onPickFile(e.target.files?.[0] ?? null)
          e.target.value = ""
        }}
      />

      <header className="relative z-40 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-zinc-950 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/slabcrack"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80"
            aria-label="Back to SlabCrack"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <CollecToolsBrand href="/" size="sm" subtitle="SlabCrack Scan" className="min-w-0" />
        </div>
        <SiteAuthButton className="shrink-0" />
      </header>

      <div className="relative z-0 min-h-0 flex-1 overflow-hidden bg-zinc-950">
        {phase === "camera" ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={cn(
                "pointer-events-none absolute inset-0 size-full object-cover",
                !cameraReady && "opacity-0",
              )}
            />
            {!cameraReady ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950 px-6 text-center">
                <Camera className="size-10 text-primary" />
                <p className="text-sm font-medium text-white">Snap a card — AI identifies it</p>
                <p className="max-w-xs text-xs text-white/55">
                  Take a photo and we’ll detect the card, then open live SlabCrack prices automatically.
                </p>
              </div>
            ) : (
              <>
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.5)_100%)]" />
                <div className="pointer-events-none absolute inset-x-[12%] top-[14%] bottom-[14%] rounded-[1.5rem] border-2 border-primary/70" />
                <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
                  <span className="rounded-full border border-white/20 bg-black/55 px-3 py-1 text-[11px] font-medium text-white/90">
                    Line up the card face
                  </span>
                </div>
              </>
            )}
          </>
        ) : snapshot ? (
          <div className="relative size-full">
            <Image src={snapshot} alt="Captured card" fill className="object-cover" unoptimized priority />
            {phase === "identifying" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/65 px-6 text-center backdrop-blur-sm">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-sm font-semibold text-white">{identifyStatus}</p>
                <p className="text-xs text-white/60">Usually a few seconds</p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/60">No snapshot</div>
        )}

        {phase === "hud" && card ? (
          <div className="absolute inset-x-0 bottom-0 z-20 space-y-3 bg-gradient-to-t from-black via-black/95 to-transparent px-4 pb-5 pt-14">
            <div className="rounded-2xl border border-white/15 bg-black/70 p-3 backdrop-blur-md">
              {detectedLabel ? (
                <p className="mb-2 text-[11px] font-medium text-primary">AI match · {detectedLabel}</p>
              ) : null}
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

      {phase === "camera" ? (
        <div className="relative z-40 shrink-0 border-t border-white/10 bg-zinc-950 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {cameraError ? (
            <p className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-center text-xs text-amber-100">
              {cameraError}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
            >
              <Camera className="size-4" />
              Take photo
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 text-sm font-semibold text-white"
            >
              <ImagePlus className="size-4" />
              Upload
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            {!cameraReady ? (
              <button
                type="button"
                disabled={cameraStarting}
                onClick={() => void startCamera()}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/15 text-sm font-semibold text-primary disabled:opacity-60"
              >
                {cameraStarting ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                {cameraStarting ? "Starting…" : "Start live camera"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={captureFrame}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-white bg-white text-sm font-bold text-black"
                >
                  <Camera className="size-4" />
                  Capture live
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white"
                >
                  Stop
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

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
          onClose={() => setDrawerOpen(false)}
          onToggleWatch={() => {}}
        />
      ) : null}
    </div>
  )
}
