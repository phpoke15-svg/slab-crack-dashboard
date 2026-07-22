import "server-only"
import crypto from "node:crypto"
import { createAdminClient } from "@/lib/supabase/server"
import {
  isAppleIapConfigured,
  planFromAppleProductId,
  priceKeyFromAppleProductId,
} from "@/lib/billing/apple-iap"
import { planRank, type PlanId } from "@/lib/billing/plans"
import { isSupremeEmail } from "@/lib/billing/plans"

const ACTIVE_STATUSES = new Set(["active", "trialing"])

type AppleTransactionPayload = {
  productId: string
  originalTransactionId: string
  transactionId: string
  expiresDate: number | null
  revocationDate: number | null
  environment: string | null
}

function base64Url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input
  return buf.toString("base64url")
}

function decodeJwsPayload(jws: string): Record<string, unknown> {
  const parts = jws.split(".")
  if (parts.length < 2) throw new Error("Invalid Apple signed payload")
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>
}

function createAppStoreApiJwt(): string {
  const keyId = process.env.APPLE_IAP_KEY_ID?.trim()
  const issuerId = process.env.APPLE_IAP_ISSUER_ID?.trim()
  const bundleId = process.env.APPLE_IAP_BUNDLE_ID?.trim() || "com.collectools.app"
  const privateKey = process.env.APPLE_IAP_PRIVATE_KEY?.trim()?.replace(/\\n/g, "\n")

  if (!keyId || !issuerId || !privateKey) {
    throw new Error("Apple IAP API credentials are not configured")
  }

  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64Url(
    JSON.stringify({
      iss: issuerId,
      iat: now,
      exp: now + 60 * 10,
      aud: "appstoreconnect-v1",
      bid: bundleId,
    }),
  )
  const input = `${header}.${payload}`
  const sign = crypto.createSign("SHA256")
  sign.update(input)
  sign.end()
  const signature = sign.sign({ key: privateKey, dsaEncoding: "ieee-p1363" })
  return `${input}.${base64Url(signature)}`
}

async function fetchAppleTransaction(
  transactionId: string,
  sandbox: boolean,
): Promise<AppleTransactionPayload> {
  const host = sandbox
    ? "https://api.storekit-sandbox.itunes.apple.com"
    : "https://api.storekit.itunes.apple.com"
  const jwt = createAppStoreApiJwt()
  const response = await fetch(`${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Apple transaction lookup failed (${response.status}): ${body.slice(0, 200)}`)
  }

  const json = (await response.json()) as { signedTransactionInfo?: string }
  if (!json.signedTransactionInfo) {
    throw new Error("Apple transaction response missing signedTransactionInfo")
  }

  const decoded = decodeJwsPayload(json.signedTransactionInfo)
  const productId = String(decoded.productId ?? "")
  const originalTransactionId = String(decoded.originalTransactionId ?? decoded.transactionId ?? "")
  const resolvedTransactionId = String(decoded.transactionId ?? transactionId)

  if (!productId || !originalTransactionId) {
    throw new Error("Apple transaction payload missing productId or originalTransactionId")
  }

  return {
    productId,
    originalTransactionId,
    transactionId: resolvedTransactionId,
    expiresDate: decoded.expiresDate ? Number(decoded.expiresDate) : null,
    revocationDate: decoded.revocationDate ? Number(decoded.revocationDate) : null,
    environment: decoded.environment ? String(decoded.environment) : null,
  }
}

export async function lookupAppleTransaction(transactionId: string): Promise<AppleTransactionPayload> {
  if (process.env.APPLE_IAP_SKIP_VERIFY === "1") {
    throw new Error("APPLE_IAP_SKIP_VERIFY is enabled — use verifyApplePurchaseDevOnly instead")
  }

  try {
    return await fetchAppleTransaction(transactionId, false)
  } catch (productionError) {
    try {
      return await fetchAppleTransaction(transactionId, true)
    } catch {
      throw productionError
    }
  }
}

function appleStatusFromTransaction(tx: AppleTransactionPayload): string {
  if (tx.revocationDate) return "canceled"
  if (tx.expiresDate && tx.expiresDate <= Date.now()) return "expired"
  return "active"
}

async function recomputeProfilePlan(userId: string): Promise<PlanId> {
  const admin = createAdminClient()
  const { data: activeSubs } = await admin
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)

  let best: PlanId = "free"
  for (const row of activeSubs ?? []) {
    if (!ACTIVE_STATUSES.has(String(row.status))) continue
    const candidate = (row.plan as PlanId) || "free"
    if (planRank(candidate) > planRank(best)) best = candidate
  }

  const { data: currentProfile } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle()
  if ((currentProfile?.plan as PlanId | undefined) === "supreme") {
    best = "supreme"
  }

  try {
    const { data: authUser } = await admin.auth.admin.getUserById(userId)
    if (isSupremeEmail(authUser.user?.email)) best = "supreme"
  } catch {
    // keep best from subs/profile
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      plan: best,
      plan_updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (profileError) throw new Error(profileError.message)
  return best
}

export async function upsertSubscriptionFromApple(input: {
  userId: string
  originalTransactionId: string
  appleProductId: string
  status: string
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd?: boolean
}): Promise<PlanId> {
  const admin = createAdminClient()
  const plan = planFromAppleProductId(input.appleProductId)
  const active = ACTIVE_STATUSES.has(input.status)

  const row = {
    user_id: input.userId,
    store: "apple",
    stripe_subscription_id: `apple:${input.originalTransactionId}`,
    stripe_price_id: null,
    stripe_product_id: null,
    apple_original_transaction_id: input.originalTransactionId,
    apple_product_id: input.appleProductId,
    status: input.status,
    plan: active ? plan : "free",
    cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
    current_period_end: input.currentPeriodEnd?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  }

  const { error: subError } = await admin
    .from("subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" })

  if (subError) throw new Error(subError.message)

  return recomputeProfilePlan(input.userId)
}

export async function verifyApplePurchaseForUser(input: {
  userId: string
  transactionId: string
  productId?: string | null
  originalTransactionId?: string | null
}): Promise<{ plan: PlanId; status: string; productId: string }> {
  const transactionId = input.transactionId.trim()
  if (!transactionId) throw new Error("transactionId required")

  let tx: AppleTransactionPayload

  if (isAppleIapConfigured()) {
    tx = await lookupAppleTransaction(transactionId)
  } else if (process.env.APPLE_IAP_SKIP_VERIFY === "1") {
    const productId = input.productId?.trim()
    if (!productId || !priceKeyFromAppleProductId(productId)) {
      throw new Error("Valid productId required when APPLE_IAP_SKIP_VERIFY=1")
    }
    tx = {
      productId,
      originalTransactionId:
        input.originalTransactionId?.trim() || `dev-${input.userId}-${productId}`,
      transactionId,
      expiresDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      revocationDate: null,
      environment: "Xcode",
    }
  } else {
    throw new Error("Apple IAP verification is not configured")
  }

  if (input.productId?.trim() && input.productId.trim() !== tx.productId) {
    throw new Error("productId does not match Apple transaction")
  }

  const status = appleStatusFromTransaction(tx)
  const plan = await upsertSubscriptionFromApple({
    userId: input.userId,
    originalTransactionId: tx.originalTransactionId,
    appleProductId: tx.productId,
    status,
    currentPeriodEnd: tx.expiresDate ? new Date(tx.expiresDate) : null,
    cancelAtPeriodEnd: false,
  })

  return { plan, status, productId: tx.productId }
}

export { isAppleIapConfigured }
