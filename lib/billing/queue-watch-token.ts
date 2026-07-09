import { createHmac, timingSafeEqual } from "crypto"

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

function secret(): string {
  return (
    process.env.QUEUE_WATCH_TOKEN_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  )
}

export function isQueueWatchTokenConfigured(): boolean {
  return Boolean(secret())
}

export function mintQueueWatchToken(userId: string, ttlMs = DEFAULT_TTL_MS): string | null {
  const key = secret()
  if (!key) return null
  const exp = Date.now() + ttlMs
  const payload = `${userId}.${exp}`
  const sig = createHmac("sha256", key).update(payload).digest("base64url")
  return `${payload}.${sig}`
}

export function verifyQueueWatchToken(token: string | null | undefined): string | null {
  if (!token) return null
  const key = secret()
  if (!key) return null

  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [userId, expRaw, sig] = parts
  const exp = Number(expRaw)
  if (!userId || !Number.isFinite(exp) || Date.now() > exp) return null

  const payload = `${userId}.${expRaw}`
  const expected = createHmac("sha256", key).update(payload).digest("base64url")
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  return userId
}
