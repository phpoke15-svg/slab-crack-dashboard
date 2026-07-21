import { createHmac, timingSafeEqual } from "node:crypto"

const REPLAY_WINDOW_MS = 5 * 60 * 1000

export function scrydexWebhookSecret(): string | null {
  return process.env.SCRYDEX_WEBHOOK_SECRET?.trim() || null
}

export function isScrydexWebhookConfigured(): boolean {
  return Boolean(scrydexWebhookSecret())
}

function parseSignatureHeader(header: string): { timestamp: string; signature: string } | null {
  const parts = header.split(",").map((part) => part.trim())
  let timestamp: string | undefined
  let signature: string | undefined

  for (const part of parts) {
    if (part.startsWith("t=")) timestamp = part.slice(2)
    if (part.startsWith("v1=")) signature = part.slice(3)
  }

  if (!timestamp || !signature) return null
  return { timestamp, signature }
}

function isFreshTimestamp(timestamp: string, nowMs = Date.now()): boolean {
  const parsed = Number(timestamp)
  if (!Number.isFinite(parsed)) return false
  const eventMs = parsed > 1_000_000_000_000 ? parsed : parsed * 1000
  return Math.abs(nowMs - eventMs) <= REPLAY_WINDOW_MS
}

export function verifyScrydexWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret = scrydexWebhookSecret(),
  nowMs = Date.now(),
): boolean {
  if (!secret || !signatureHeader) return false

  const parsed = parseSignatureHeader(signatureHeader)
  if (!parsed) return false
  if (!isFreshTimestamp(parsed.timestamp, nowMs)) return false

  const signedPayload = `${parsed.timestamp}.${rawBody}`
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex")

  try {
    const received = Buffer.from(parsed.signature, "hex")
    const expectedBuf = Buffer.from(expected, "hex")
    if (received.length !== expectedBuf.length) return false
    return timingSafeEqual(received, expectedBuf)
  } catch {
    return false
  }
}
