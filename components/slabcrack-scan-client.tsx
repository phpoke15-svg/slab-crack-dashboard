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
import { DEFAULT_PSA_GRADING_FEE } from "@/lib/psa-grading-tiers"
import {
  getBestGradeQuote,
  getGradeQuotes,
  normalizeCardEntry,
  resolvePsa10Price,
  type MockCardEntry,
} from "@/lib/slab-data"

type ScanTool = "slabcrack" | "slablab"
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
  matchScore?: number
}

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

/** Downscale/compress camera photos so vision API stays fast + under body limits. */
async function compressImageDataUrl(dataUrl: string, maxEdge = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
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
        reject(new Error("Could not process this photo. Try Take photo again as JPEG."))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL("image/jpeg", quality))
    }
    img.onerror = () =>
      reject(new Error("Could not read this image. Use Take photo (not HEIC/Live Photo)."))
    img.src = dataUrl
  })
}

function waitForVideoFrame(video: HTMLVideoElement, timeoutMs = 4000): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer)
      video.removeEventListener("loadeddata", onReady)
      video.removeEventListener("loadedmetadata", onReady)
    }
    const onReady = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        cleanup()
        resolve()
      }
    }
    const timer = window.setTimeout(() => {
      cleanup()
      if (video.videoWidth > 0 && video.videoHeight > 0) resolve()
      else reject(new Error("Camera preview never produced a frame."))
    }, timeoutMs)
    video.addEventListener("loadeddata", onReady)
    video.addEventListener("loadedmetadata", onReady)
  })
}

export function SlabcrackScanClient({ tool = "slabcrack" }: { tool?: ScanTool }) {
  const backHref = tool === "slablab" ? "/slablab" : "/slabcrack"
  const toolLabel = tool === "slablab" ? "SlabLab Scan" : "SlabCrack Scan"
  const toolBlurb =
    tool === "slablab"
      ? "Take a photo and we'll detect the card, then open PSA 10 spread / ROI automatically."
      : "Take a photo and we'll detect the card, then open live SlabCrack prices automatically."
  const toolTagline =
    tool === "slablab" ? "Snap a card — PSA 10 ROI pops up" : "Snap a card — AI identifies it"

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const identifyingRef = useRef(false)
  const seededHitsRef = useRef<CardSearchHit[]>([])
  const seedQueryRef = useRef("")
  const aiCandidatesRef = useRef<CardSearchHit[]>([])

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
      await waitForVideoFrame(video)
      setCameraReady(true)
    } catch (err) {
      stopCamera()
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

    // Keep AI candidates until the user edits away from the seeded query.
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
      // Also pass name context so the API can recover if the PC id fetch fails.
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

  const autoIdentify = useCallback(
    async (dataUrl: string) => {
      if (identifyingRef.current) return
      identifyingRef.current = true
      setPhase("identifying")
      setIdentifyStatus("Detecting card with AI…")
      setLookupError(null)
      setDetectedLabel(null)
      setCard(null)
      seededHitsRef.current = []
      seedQueryRef.current = ""
      aiCandidatesRef.current = []

      try {
        const compressed = await compressImageDataUrl(dataUrl)
        setIdentifyStatus("Matching catalog + pulling prices…")
        const res = await fetch("/api/slabcrack/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: compressed }),
        })
        const json = (await res.json().catch(() => null)) as IdentifyResponse | null

        const label = [
          json?.detected?.cardName,
          json?.detected?.cardNumber ? `#${json.detected.cardNumber}` : null,
        ]
          .filter(Boolean)
          .join(" ")

        if (!res.ok || !json?.ok) {
          enterManualHandoff({
            query: json?.query || json?.detected?.cardName || "",
            candidates: json?.candidates,
            error: json?.error || "Could not identify this card automatically.",
            label: label || null,
          })
          return
        }

        setDetectedLabel(label || null)
        aiCandidatesRef.current = json.candidates ?? []

        if (json.card) {
          let priced = normalizeCardEntry(json.card)
          // Identify sometimes returns a catalog placeholder — refresh live comps.
          if (priced.hasPricing === false && json.hit) {
            setIdentifyStatus("Loading live prices…")
            setCard(priced)
            setPhase("hud")
            try {
              priced = await fetchPricedCard(json.hit)
              setCard(priced)
            } catch {
              /* keep placeholder */
            }
            if (priced.hasPricing === false) {
              setLookupError("Matched the card, but live PriceCharting comps didn’t load. Try Wrong card or Rescan.")
            }
            return
          }
          setCard(priced)
          setPhase("hud")
          return
        }

        // No attached card, but search found matches — price the top hit instead of stalling.
        if (json.candidates?.length) {
          const top = json.candidates[0]!
          setIdentifyStatus("Loading live prices…")
          setPhase("hud")
          setCard(searchHitToPlaceholder(top))
          try {
            const priced = await fetchPricedCard(top)
            setCard(priced)
            if (priced.hasPricing === false) {
              setLookupError("Matched the card, but live prices are unavailable. Try another match via Wrong card.")
            }
          } catch {
            setCard(normalizeCardEntry(searchHitToPlaceholder(top)))
            setLookupError("Matched the card, but price lookup failed. Try Wrong card or Rescan.")
          }
          return
        }

        enterManualHandoff({
          query: json.query || label || "",
          candidates: json.candidates,
          error: "AI read the card, but catalog search found no match. Edit the search and pick one.",
          label: label || null,
        })
      } catch (error) {
        enterManualHandoff({
          query: "",
          error:
            error instanceof Error
              ? error.message
              : "Identification failed. Search manually below.",
        })
      } finally {
        identifyingRef.current = false
      }
    },
    [enterManualHandoff, fetchPricedCard],
  )

  const goIdentify = (dataUrl: string) => {
    if (identifyingRef.current) return
    setSnapshot(dataUrl)
    void autoIdentify(dataUrl)
  }

  const captureFrame = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !cameraReady) return
    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      setCameraError("Camera isn’t ready yet — wait a second, then Capture again.")
      return
    }

    const w = video.videoWidth
    const h = video.videoHeight
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
    setPhase("hud")
    try {
      const priced = await fetchPricedCard(hit)
      setCard(priced)
      if (priced.hasPricing === false) {
        setLookupError("Catalog match loaded, but live PriceCharting comps are missing for this card.")
      }
    } catch {
      setCard(normalizeCardEntry(searchHitToPlaceholder(hit)))
      setLookupError("Price lookup failed — showing the catalog match without live comps.")
    } finally {
      setLookupLoading(false)
    }
  }

  const resetScan = () => {
    identifyingRef.current = false
    seededHitsRef.current = []
    seedQueryRef.current = ""
    aiCandidatesRef.current = []
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
                <p className="text-sm font-medium text-white">{toolTagline}</p>
                <p className="max-w-xs text-xs text-white/55">{toolBlurb}</p>
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
                  {tool === "slabcrack" ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-xs text-white">
                        Raw {formatMoney(card.rawPrice)}
                      </span>
                      {best?.isArbitrage ? (
                        <DeficitBadge diff={best.deficit} pct={best.percentageSavings} size="sm" />
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-white/15 bg-white/5 px-2 py-1 font-mono text-xs text-white">
                        Raw {formatMoney(card.rawPrice)}
                      </span>
                      <span className="rounded-md border border-primary/40 bg-primary/15 px-2 py-1 font-mono text-xs text-primary">
                        PSA 10 {formatMoney(labPsa10)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {tool === "slabcrack" ? (
                <div className="mt-3">
                  <GradePriceGrid quotes={quotes} priced={card.hasPricing !== false} compact />
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2">
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
                    {!labReady
                      ? " Pricing may be incomplete if PSA 10 comps are thin."
                      : ""}
                  </p>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {tool === "slabcrack" ? (
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    Full SlabCrack data
                  </button>
                ) : (
                  <Link
                    href="/slablab"
                    className="inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    Open SlabLab board
                  </Link>
                )}
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
