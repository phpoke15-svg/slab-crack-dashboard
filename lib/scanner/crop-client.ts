import type { DetectedCardBounds } from "@/lib/scanner/types"

/** Crop a normalized region from a JPEG/PNG data URL (browser). */
export async function cropDataUrlRegion(
  dataUrl: string,
  box: Pick<DetectedCardBounds, "x" | "y" | "w" | "h">,
  maxEdge = 512,
  quality = 0.62,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      const sx = Math.round(box.x * img.width)
      const sy = Math.round(box.y * img.height)
      const sw = Math.max(1, Math.round(box.w * img.width))
      const sh = Math.max(1, Math.round(box.h * img.height))
      const scale = Math.min(1, maxEdge / Math.max(sw, sh))
      const outW = Math.max(1, Math.round(sw * scale))
      const outH = Math.max(1, Math.round(sh * scale))
      const canvas = document.createElement("canvas")
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Could not process image crop"))
        return
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
      resolve(canvas.toDataURL("image/jpeg", quality))
    }
    img.onerror = () => reject(new Error("Could not read image for crop"))
    img.src = dataUrl
  })
}
