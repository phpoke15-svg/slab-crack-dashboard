import { createVerify } from "crypto"

const GOOGLE_ADMOB_VERIFIER_KEYS_URL =
  "https://www.gstatic.com/admob/reward/verifier-keys.json"

type VerifierKey = {
  keyId: number
  pem: string
  base64: string
}

type VerifierKeysResponse = {
  keys: VerifierKey[]
}

let cachedKeys: VerifierKey[] | null = null
let cachedAt = 0
const KEY_CACHE_MS = 60 * 60 * 1000

async function loadVerifierKeys(): Promise<VerifierKey[]> {
  if (cachedKeys && Date.now() - cachedAt < KEY_CACHE_MS) return cachedKeys

  const response = await fetch(GOOGLE_ADMOB_VERIFIER_KEYS_URL, {
    next: { revalidate: 3600 },
  })
  if (!response.ok) {
    throw new Error(`Failed to load Google ad verifier keys (${response.status})`)
  }

  const json = (await response.json()) as VerifierKeysResponse
  cachedKeys = json.keys ?? []
  cachedAt = Date.now()
  return cachedKeys
}

export type GoogleAdSsvPayload = {
  adNetwork: string
  adUnit: string
  customData: string | null
  rewardAmount: string
  rewardItem: string
  timestamp: string
  transactionId: string
  userId: string | null
  signature: string
  keyId: string
}

function pemFromBase64(base64: string): string {
  const wrapped = base64.match(/.{1,64}/g)?.join("\n") ?? base64
  return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`
}

/** Build the UTF-8 message Google signs (params in URL order, excluding signature & key_id). */
export function buildGoogleAdSsvMessage(url: URL): string {
  const parts: string[] = []
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "signature" || key === "key_id") continue
    parts.push(`${key}=${value}`)
  }
  return parts.join("&")
}

export function parseGoogleAdSsvPayload(url: URL): GoogleAdSsvPayload | null {
  const signature = url.searchParams.get("signature")
  const keyId = url.searchParams.get("key_id")
  const transactionId = url.searchParams.get("transaction_id")
  const timestamp = url.searchParams.get("timestamp")

  if (!signature || !keyId || !transactionId || !timestamp) return null

  return {
    adNetwork: url.searchParams.get("ad_network") ?? "",
    adUnit: url.searchParams.get("ad_unit") ?? "",
    customData: url.searchParams.get("custom_data"),
    rewardAmount: url.searchParams.get("reward_amount") ?? "",
    rewardItem: url.searchParams.get("reward_item") ?? "",
    timestamp,
    transactionId,
    userId: url.searchParams.get("user_id"),
    signature,
    keyId,
  }
}

export async function verifyGoogleAdSsv(url: URL): Promise<{
  ok: boolean
  userId?: string
  transactionId?: string
  error?: string
}> {
  const payload = parseGoogleAdSsvPayload(url)
  if (!payload) {
    return { ok: false, error: "Missing required SSV parameters" }
  }

  const keys = await loadVerifierKeys()
  const key = keys.find((entry) => String(entry.keyId) === payload.keyId)
  if (!key) {
    return { ok: false, error: "Unknown verifier key_id" }
  }

  const message = buildGoogleAdSsvMessage(url)
  const verifier = createVerify("SHA256")
  verifier.update(message)
  verifier.end()

  const publicKey = key.pem || pemFromBase64(key.base64)
  const valid = verifier.verify(publicKey, payload.signature, "base64")
  if (!valid) {
    return { ok: false, error: "Invalid SSV signature" }
  }

  const userId = payload.customData?.trim() || payload.userId?.trim()
  if (!userId) {
    return { ok: false, error: "SSV payload missing user id (custom_data or user_id)" }
  }

  return { ok: true, userId, transactionId: payload.transactionId }
}

/** Skip SSV verification in local dev when explicitly enabled. */
export function isAdRewardDevBypassEnabled(): boolean {
  return process.env.AD_REWARD_DEV_BYPASS === "true"
}
