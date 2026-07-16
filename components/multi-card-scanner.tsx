"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ImagePlus, Loader2, ScanLine } from "lucide-react"
import { cn } from "@/lib/utils"
import { cropDataUrlRegion } from "@/lib/scanner/crop-client"
import { captureFullFrame } from "@/lib/scanner/capture"
import { dHashFromImageSource } from "@/lib/scanner/phash"
import { StabilityGate } from "@/lib/scanner/stability"
import type { BatchScanResult, DetectedCardBounds } from "@/lib/scanner/types"
import type { DetectedCardBox } from "@/lib/slabcrack/detect-card-boxes-parse"

async function phashFromDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      void dHashFromImageSource(img, 128, 180).then(resolve).catch(reject)
    }
    img.onerror = () => reject(new Error("Could not read image for fingerprint"))
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

function boxToBounds(box: DetectedCardBox): DetectedCardBounds {
  return { x: box.x, y: box.y, w: box.w, h: box.h, confidence: box.confidence }
}

export type MultiCardScannerProps = {
  autoScan?: boolean
  scanning?: boolean
  processingMessage?: string
  onScanStart?: () => void
  onScanProgress?: (message: string) => void
  onScanComplete: (result: BatchScanResult, frame: string) => void
  onScanFail: (error: string, frame: string | null) => void
  className?: string
  immersive?: boolean
}

export function MultiCardScanner({
  autoScan = true,
  scanning = false,
  processingMessage,
  onScanStart,
  onScanProgress,
  onScanComplete,
  onScanFail,
  className,
  immersive = false,
}: MultiCardScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const gateRef = useRef(new StabilityGate())
  const rafRef = useRef<number>(0)
  const scanLockRef = useRef(false)
  const lastScanAtRef = useRef(0)

  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [stability, setStability] = useState({ blur: 0, motion: 999, stable: false })

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
          width: { ideal: 1280 },
          height: { ideal: 720 },
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

  const runBatchScan = useCallback(
    async (frame: string) => {
      onScanProgress?.("Finding cards…")

      const boxRes = await fetch("/api/slabcrack/identify/boxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: frame }),
      })
      const boxJson = (await boxRes.json().catch(() => null)) as
        | { ok?: boolean; boxes?: DetectedCardBox[]; error?: string }
        | null

      if (!boxRes.ok || !boxJson?.ok || !boxJson.boxes?.length) {
        throw new Error(boxJson?.error || "No cards detected in frame.")
      }

      const boxes = boxJson.boxes
      onScanProgress?.(`Identifying ${boxes.length} card${boxes.length === 1 ? "" : "s"}…`)

      const items = await Promise.all(
        boxes.map(async (box) => {
          const crop = await cropDataUrlRegion(frame, box)
          const phash = await phashFromDataUrl(crop)
          return { image: crop, phash, bounds: boxToBounds(box) }
        }),
      )

      const res = await fetch("/api/scanner/scan-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      const json = (await res.json().catch(() => null)) as
        | (BatchScanResult & { error?: string })
        | null

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Batch scan failed.")
      }

      onScanComplete(json as BatchScanResult, frame)
    },
    [onScanComplete, onScanProgress],
  )

  const runScan = useCallback(
    async (fromVideo: HTMLVideoElement) => {
      if (scanLockRef.current || scanning) return
      scanLockRef.current = true
      lastScanAtRef.current = Date.now()
      gateRef.current.reset()
      onScanStart?.()

      try {
        const frame = await captureFullFrame(fromVideo, 768, 0.55)
        await runBatchScan(frame)
      } catch (err) {
        onScanFail(err instanceof Error ? err.message : "Scan failed", null)
      } finally {
        scanLockRef.current = false
      }
    },
    [onScanFail, onScanStart, runBatchScan, scanning],
  )

  const runScanFromFrame = useCallback(
    async (frame: string) => {
      if (scanLockRef.current || scanning) return
      scanLockRef.current = true
      lastScanAtRef.current = Date.now()
      onScanStart?.()
      try {
        await runBatchScan(frame)
      } catch (err) {
        onScanFail(err instanceof Error ? err.message : "Scan failed", frame)
      } finally {
        scanLockRef.current = false
      }
    },
    [onScanFail, onScanStart, runBatchScan, scanning],
  )

  const manualCapture = useCallback(() => {
    const video = videoRef.current
    if (!video || !cameraReady) return
    void runScan(video)
  }, [cameraReady, runScan])

  useEffect(() => {
    if (!autoScan || !cameraReady || scanning) {
      cancelAnimationFrame(rafRef.current)
      return
    }

    const loop = () => {
      const video = videoRef.current
      if (video && video.videoWidth > 0 && !scanLockRef.current) {
        const fired = gateRef.current.tick(video)
        setStability(gateRef.current.sample)
        const cooldownOk = Date.now() - lastScanAtRef.current > 3500
        if (fired && cooldownOk) void runScan(video)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [autoScan, cameraReady, runScan, scanning])

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        void runScanFromFrame(dataUrl)
      }
      reader.readAsDataURL(file)
    },
    [runScanFromFrame],
  )

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
          <div className="absolute inset-x-0 top-3 flex justify-center">
            <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
              Fit 1–9 cards in frame
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium backdrop-blur-sm",
                stability.stable
                  ? "bg-primary/90 text-primary-foreground"
                  : "bg-black/60 text-white/90",
              )}
            >
              {scanning
                ? "Processing…"
                : stability.stable
                  ? autoScan
                    ? "Hold steady — scanning…"
                    : "Steady — tap Scan"
                  : "Hold binder or cards steady"}
            </span>
          </div>
        </div>
      )}

      {(cameraStarting || scanning) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45 px-6 text-center backdrop-blur-[2px]">
          <Loader2 className="size-10 animate-spin text-primary" aria-hidden="true" />
          {scanning && processingMessage ? (
            <p className="max-w-[16rem] text-sm font-semibold text-white">{processingMessage}</p>
          ) : null}
        </div>
      )}

      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/95 p-4 text-center">
          <p className="text-sm text-muted-foreground">{cameraError}</p>
        </div>
      )}

      <div className="absolute bottom-4 right-4 flex gap-2">
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
        <button
          type="button"
          onClick={manualCapture}
          disabled={!cameraReady || scanning}
          className="inline-flex items-center gap-1.5 rounded-xl border border-primary/50 bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <ScanLine className="size-4" />
          Scan now
        </button>
      </div>
    </div>
  )
}
