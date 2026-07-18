"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ImagePlus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { captureCardFromVideo, defaultGuideBounds } from "@/lib/scanner/capture"
import {
  POINT_SCAN_SAME_CARD_COOLDOWN_MS,
  SCAN_STABILITY_HOLD_MS,
} from "@/lib/scanner/capture-settings"
import { preloadOcrWorker, releaseOcrWorker } from "@/lib/scanner/ocr-client"
import { matchPointScanSnapshot } from "@/lib/scanner/point-scan-match"
import { scanHapticMatch } from "@/lib/scanner/point-scan"
import { StabilityGate } from "@/lib/scanner/stability"
import type { ScanPipelineResult } from "@/lib/scanner/types"

const SCAN_COOLDOWN_MS = 2500

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

export type CardScannerProps = {
  /** Pause the live scan loop (e.g. while the match sheet is open). */
  paused?: boolean
  onMatch: (result: ScanPipelineResult, snapshot: string) => void
  onScanFail?: (error: string, snapshot: string | null) => void
  className?: string
  immersive?: boolean
}

export function CardScanner({
  paused = false,
  onMatch,
  onScanFail,
  className,
  immersive = false,
}: CardScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const gateRef = useRef(new StabilityGate({ holdMs: SCAN_STABILITY_HOLD_MS }))
  const rafRef = useRef<number>(0)
  const scanBusyRef = useRef(false)
  const lastScanAtRef = useRef(0)
  const lastMatchIdRef = useRef<string | null>(null)
  const lastMatchAtRef = useRef(0)

  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [stability, setStability] = useState({ blur: 0, motion: 999, stable: false })
  const [guide, setGuide] = useState(defaultGuideBounds())
  const [scanning, setScanning] = useState(false)
  const [statusNote, setStatusNote] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    const video = videoRef.current
    const stream = video?.srcObject as MediaStream | null
    stream?.getTracks().forEach((t) => t.stop())
    if (video) video.srcObject = null
    setCameraReady(false)
  }, [])

  useEffect(() => {
    void preloadOcrWorker()
    return () => {
      void releaseOcrWorker()
    }
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setCameraStarting(true)
    setCameraReady(false)
    stopCamera()

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setCameraError("Camera needs HTTPS. Use Upload instead.")
      setCameraStarting(false)
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Live camera isn’t available here. Use Upload.")
      setCameraStarting(false)
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
      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((t) => t.stop())
        setCameraStarting(false)
        return
      }
      video.srcObject = stream
      video.setAttribute("playsinline", "true")
      video.muted = true
      await video.play()
      await waitForVideoFrame(video)
      setGuide(defaultGuideBounds(video.videoWidth, video.videoHeight))
      setCameraReady(true)
      gateRef.current.reset()
    } catch (err) {
      stopCamera()
      const name = err instanceof DOMException ? err.name : ""
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraError("Camera permission blocked. Allow camera or use Upload.")
      } else {
        setCameraError("Could not open camera.")
      }
    } finally {
      setCameraStarting(false)
    }
  }, [stopCamera])

  useEffect(() => {
    void startCamera()
    return () => {
      cancelAnimationFrame(rafRef.current)
      stopCamera()
    }
  }, [startCamera, stopCamera])

  const deliverMatch = useCallback(
    (json: ScanPipelineResult, snapshot: string) => {
      const cardId = json.hit?.id ?? json.card?.id ?? null
      if (
        cardId &&
        cardId === lastMatchIdRef.current &&
        Date.now() - lastMatchAtRef.current < POINT_SCAN_SAME_CARD_COOLDOWN_MS
      ) {
        return
      }

      lastMatchIdRef.current = cardId
      lastMatchAtRef.current = Date.now()
      setStatusNote(null)
      scanHapticMatch()
      onMatch(json, snapshot)
    },
    [onMatch],
  )

  const tryMatchFrame = useCallback(
    async (video: HTMLVideoElement) => {
      if (scanBusyRef.current || paused) return
      scanBusyRef.current = true
      lastScanAtRef.current = Date.now()
      setScanning(true)
      setStatusNote("Reading card…")

      try {
        const snapshot = await captureCardFromVideo(video, guide)
        setStatusNote("Matching card…")
        const outcome = await matchPointScanSnapshot(snapshot)

        if (!outcome.ok) {
          setStatusNote(null)
          return
        }

        if (!outcome.result.card) {
          onScanFail?.("Could not match this card. Try manual search.", snapshot)
          return
        }

        deliverMatch(outcome.result, snapshot)
      } catch (err) {
        onScanFail?.(err instanceof Error ? err.message : "Scan failed", null)
      } finally {
        scanBusyRef.current = false
        setScanning(false)
      }
    },
    [deliverMatch, guide, onScanFail, paused],
  )

  useEffect(() => {
    if (!cameraReady || paused) {
      cancelAnimationFrame(rafRef.current)
      return
    }

    const loop = () => {
      const video = videoRef.current
      if (video && video.videoWidth > 0 && !scanBusyRef.current) {
        const ready = gateRef.current.tick(video, guide)
        setStability(gateRef.current.sample)
        const cooldownOk = Date.now() - lastScanAtRef.current >= SCAN_COOLDOWN_MS
        if (ready && cooldownOk) {
          void tryMatchFrame(video)
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(rafRef.current)
  }, [cameraReady, guide, paused, tryMatchFrame])

  const handleFile = useCallback(
    async (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        void (async () => {
          scanBusyRef.current = true
          setScanning(true)
          setStatusNote("Reading card…")
          try {
            const outcome = await matchPointScanSnapshot(dataUrl)
            if (!outcome.ok) {
              onScanFail?.(outcome.error, dataUrl)
              return
            }
            if (!outcome.result.card) {
              onScanFail?.("Could not match this card. Try manual search.", dataUrl)
              return
            }
            scanHapticMatch()
            onMatch(outcome.result, dataUrl)
          } catch (err) {
            onScanFail?.(err instanceof Error ? err.message : "Scan failed", dataUrl)
          } finally {
            scanBusyRef.current = false
            setScanning(false)
            setStatusNote(null)
          }
        })()
      }
      reader.readAsDataURL(file)
    },
    [onMatch, onScanFail],
  )

  const g = guide
  const pulsing = cameraReady && !paused && stability.stable

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-black", className)}>
      <video
        ref={videoRef}
        className={cn(
          "w-full object-cover",
          immersive ? "h-full min-h-full" : "aspect-[3/4] sm:aspect-video",
        )}
        playsInline
        muted
      />

      {cameraReady && (
        <div className="pointer-events-none absolute inset-0">
          <div
            className={cn(
              "absolute rounded-xl border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] transition-colors duration-300",
              pulsing ? "animate-pulse border-primary" : "border-white/70",
            )}
            style={{
              left: `${g.x * 100}%`,
              top: `${g.y * 100}%`,
              width: `${g.width * 100}%`,
              height: `${g.height * 100}%`,
            }}
          >
            <span className="absolute left-0 top-0 size-5 border-l-2 border-t-2 border-white/90" />
            <span className="absolute right-0 top-0 size-5 border-r-2 border-t-2 border-white/90" />
            <span className="absolute bottom-0 left-0 size-5 border-b-2 border-l-2 border-white/90" />
            <span className="absolute bottom-0 right-0 size-5 border-b-2 border-r-2 border-white/90" />
          </div>
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium backdrop-blur-sm",
                paused
                  ? "bg-black/60 text-white/90"
                  : stability.stable
                    ? "bg-primary/90 text-primary-foreground"
                    : "bg-black/60 text-white/90",
              )}
            >
              {paused
                ? "Match found — add or scan next"
                : statusNote ??
                  (scanning
                    ? "Identifying card…"
                    : stability.stable
                      ? "Point at card — auto matching"
                      : "Hold steady — align name & number")}
            </span>
          </div>
        </div>
      )}

      {cameraStarting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/35 px-6 text-center">
          <Loader2 className="size-10 animate-spin text-primary" aria-hidden="true" />
        </div>
      )}

      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/95 p-4 text-center">
          <p className="text-sm text-muted-foreground">{cameraError}</p>
        </div>
      )}

      <div className="absolute bottom-4 right-4">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-card/90 px-3 py-2 text-xs font-semibold text-foreground backdrop-blur-sm">
          <ImagePlus className="size-4" aria-hidden="true" />
          Upload
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
              e.target.value = ""
            }}
          />
        </label>
      </div>
    </div>
  )
}
