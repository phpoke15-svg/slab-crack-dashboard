import "server-only"
import sharp from "sharp"
import { dHashFromRgba, dHashToHex } from "@/lib/scanner/phash"
import type { DetectedCardBounds } from "@/lib/scanner/types"

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) throw new Error("Expected a data:image base64 URL.")
  return { mime: match[1]!, buffer: Buffer.from(match[2]!, "base64") }
}

/** Server-side crop from a full-frame data URL. */
export async function cropDataUrlRegionServer(
  dataUrl: string,
  box: Pick<DetectedCardBounds, "x" | "y" | "w" | "h">,
  maxEdge = 512,
  quality = 62,
): Promise<string> {
  const { buffer } = parseDataUrl(dataUrl)
  const meta = await sharp(buffer).metadata()
  const fw = meta.width ?? 0
  const fh = meta.height ?? 0
  if (fw <= 0 || fh <= 0) throw new Error("Invalid image dimensions")

  const left = Math.max(0, Math.round(box.x * fw))
  const top = Math.max(0, Math.round(box.y * fh))
  const width = Math.max(1, Math.min(fw - left, Math.round(box.w * fw)))
  const height = Math.max(1, Math.min(fh - top, Math.round(box.h * fh)))
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const outW = Math.max(1, Math.round(width * scale))
  const outH = Math.max(1, Math.round(height * scale))

  const out = await sharp(buffer)
    .extract({ left, top, width, height })
    .resize(outW, outH, { fit: "fill" })
    .jpeg({ quality })
    .toBuffer()

  return `data:image/jpeg;base64,${out.toString("base64")}`
}

export async function phashFromDataUrlServer(dataUrl: string): Promise<string> {
  const { buffer } = parseDataUrl(dataUrl)
  const { data, info } = await sharp(buffer)
    .resize(128, 180, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return dHashToHex(dHashFromRgba(data, info.width, info.height))
}
