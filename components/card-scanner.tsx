"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ImagePlus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { captureCardFromVideo, defaultGuideBounds } from "@/lib/scanner/capture"
import {
  POINT_SCAN_FRAME_MS,
  POINT_SCAN_SAME_CARD_COOLDOWN_MS,
  SCAN_CAPTURE_MAX_EDGE,
} from "@/lib/scanner/capture-settings"
import {
  preloadOcrWorker,
  recognizeCardText,
  releaseOcrWorker,
} from "@/lib/scanner/ocr-client"
import { hasOcrMatchFields } from "@/lib/scanner/ocr-parse"
import { scanHapticMatch } from "@/lib/scanner/point-scan"
import { StabilityGate } from "@/lib/scanner/stability"
import type { ScanPipelineResult } from "@/lib/scanner/types"

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
  /** Pause the live OCR loop (e.g. while the match sheet is open). */
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
  const gateRef = useRef(new StabilityGate())
  const rafRef = useRef<number>(0)
  const frameTimerRef = useRef<number>(0)
  const ocrBusyRef = useRef(false)
  const lastMatchIdRef = useRef<string | null>(null)
  const lastMatchAtRef = useRef(0)

  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [stability, setStability] = useState({ blur: 0, motion: 999, stable: false })
  const [guide, setGuide] = useState(defaultGuideBounds())
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    void preloadOcrWorker()
    return () => {
      void releaseOcrWorker()
    }
  }, [])

  const stopCamera = useCallback(() => {
    const video = videoRef.current
    const stream = video?.srcObject as MediaStream | null
    stream?.getTracks().forEach((t) => t.stop())
    if (video) video.srcObject = null
    setCameraReady(false)
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
      window.clearInterval(frameTimerRef.current)
      stopCamera()
    }
  }, [startCamera, stopCamera])

  const tryMatchFrame = useCallback(
    async (video: HTMLVideoElement) => {
      if (ocrBusyRef.current || paused) return
      ocrBusyRef.current = true
      setScanning(true)

      try {
        const snapshot = await captureCardFromVideo(
          video,
          guide,
          SCAN_CAPTURE_MAX_EDGE,
        )
        const detected = await recognizeCardText(snapshot).catch(() => null)
        if (!hasOcrMatchFields(detected)) return

        const res = await fetch("/api/scanner/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ detected }),
        })
        const json = (await res.json().catch(() => null)) as
          | (ScanPipelineResult & { error?: string })
          | null

        if (!res.ok || !json?.ok) return

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
        scanHapticMatch()
        onMatch(json as ScanPipelineResult, snapshot)
      } catch (err) {
        onScanFail?.(err instanceof Error ? err.message : "Scan failed", null)
      } finally {
        ocrBusyRef.current = false
        setScanning(false)
      }
    },
    [guide, onMatch, onScanFail, paused],
  )

  useEffect(() => {
    if (!cameraReady || paused) {
      window.clearInterval(frameTimerRef.current)
      cancelAnimationFrame(rafRef.current)
      return
    }

    const loop = () => {
      const video = videoRef.current
      if (video && video.videoWidth > 0) {
        gateRef.current.tick(video, guide)
        setStability(gateRef.current.sample)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    frameTimerRef.current = window.setInterval(() => {
      const video = videoRef.current
      if (!video || video.videoWidth <= 0 || ocrBusyRef.current || paused) return
      if (!gateRef.current.sample.stable) return
      void tryMatchFrame(video)
    }, POINT_SCAN_FRAME_MS)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.clearInterval(frameTimerRef.current)
    }
  }, [cameraReady, guide, paused, tryMatchFrame])

  const handleFile = useCallback(
    async (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        void (async () => {
          ocrBusyRef.current = true
          setScanning(true)
          try {
            const detected = await recognizeCardText(dataUrl).catch(() => null)
            if (!hasOcrMatchFields(detected)) {
              onScanFail?.("Could not read card name and number from image.", dataUrl)
              return
            }
            const res = await fetch("/api/scanner/match", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ detected }),
            })
            const json = (await res.json().catch(() => null)) as
              | (ScanPipelineResult & { error?: string })
              | null
            if (!res.ok || !json?.ok) {
              onScanFail?.(json?.error || "No catalog match for this card.", dataUrl)
              return
            }
            scanHapticMatch()
            onMatch(json as ScanPipelineResult, dataUrl)
          } catch (err) {
            onScanFail?.(err instanceof Error ? err.message : "Scan failed", dataUrl)
          } finally {
            ocrBusyRef.current = false
            setScanning(false)
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
                : scanning
                  ? "Reading card…"
                  : stability.stable
                    ? "Point at card — auto matching"
                    : "Align name & number in frame"}
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
