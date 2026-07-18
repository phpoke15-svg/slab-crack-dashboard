import type { CardBounds } from "@/lib/scanner/types"

const OCR_MIN_EDGE = 1280

function sharpenInPlace(data: Uint8ClampedArray, w: number, h: number): void {
  const copy = new Uint8ClampedArray(data)
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]

  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      let sum = 0
      let ki = 0
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const idx = ((y + ky) * w + (x + kx)) * 4
          sum += copy[idx]! * kernel[ki]!
          ki += 1
        }
      }
      const out = Math.max(0, Math.min(255, sum))
      const i = (y * w + x) * 4
      data[i] = out
      data[i + 1] = out
      data[i + 2] = out
    }
  }
}

function boostContrastInPlace(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.45 + 128))
    data[i] = contrast
    data[i + 1] = contrast
    data[i + 2] = contrast
  }
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Could not load scan image"))
    img.src = dataUrl
  })
}

function renderToCanvas(
  img: HTMLImageElement,
  outW: number,
  outH: number,
  sx = 0,
  sy = 0,
  sw = img.width,
  sh = img.height,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Could not process scan image")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
  return canvas
}

/** Upscale + grayscale + contrast + sharpen for Tesseract. */
export async function preprocessOcrImage(imageDataUrl: string): Promise<string> {
  try {
    const img = await loadImage(imageDataUrl)
    const longest = Math.max(img.width, img.height)
    const scale = longest < OCR_MIN_EDGE ? OCR_MIN_EDGE / longest : 1
    const outW = Math.max(1, Math.round(img.width * scale))
    const outH = Math.max(1, Math.round(img.height * scale))

    const canvas = renderToCanvas(img, outW, outH)
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return imageDataUrl

    const imageData = ctx.getImageData(0, 0, outW, outH)
    boostContrastInPlace(imageData.data)
    sharpenInPlace(imageData.data, outW, outH)
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL("image/jpeg", 0.96)
  } catch {
    return imageDataUrl
  }
}

/** Crop a fractional region of a card image for targeted OCR (name / number strips). */
export async function preprocessOcrRegion(
  imageDataUrl: string,
  region: CardBounds,
): Promise<string> {
  try {
    const img = await loadImage(imageDataUrl)
    const sx = Math.round(region.x * img.width)
    const sy = Math.round(region.y * img.height)
    const sw = Math.max(1, Math.round(region.width * img.width))
    const sh = Math.max(1, Math.round(region.height * img.height))

    const longest = Math.max(sw, sh)
    const scale = longest < 720 ? 720 / longest : 1
    const outW = Math.max(1, Math.round(sw * scale))
    const outH = Math.max(1, Math.round(sh * scale))

    const canvas = renderToCanvas(img, outW, outH, sx, sy, sw, sh)
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return imageDataUrl

    const imageData = ctx.getImageData(0, 0, outW, outH)
    boostContrastInPlace(imageData.data)
    sharpenInPlace(imageData.data, outW, outH)
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL("image/jpeg", 0.96)
  } catch {
    return imageDataUrl
  }
}
