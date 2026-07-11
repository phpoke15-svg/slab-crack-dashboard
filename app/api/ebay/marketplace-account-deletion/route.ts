import { createHash } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { getSiteUrl } from "@/lib/site-url"

export const dynamic = "force-dynamic"

/**
 * eBay Developers Program — Marketplace Account Deletion/Closure notifications.
 * https://developer.ebay.com/marketplace-account-deletion
 *
 * CollecTools does not persist eBay user PII. We still expose this endpoint so a
 * Production keyset can be activated (challenge handshake + 200 OK acknowledgements).
 *
 * Prefer EBAY_NOTIFICATION_VERIFICATION_TOKEN on Vercel; falls back to DEFAULT_TOKEN
 * so Production keysets can activate without a separate env step.
 */

const DEFAULT_TOKEN = "CollecToolsEbayNotifyToken2026Secure01"
const DEFAULT_ENDPOINT =
  "https://slab-crack-dashboard.vercel.app/api/ebay/marketplace-account-deletion"

function verificationToken(): string {
  const token = process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN?.trim() || DEFAULT_TOKEN
  if (token.length < 32 || token.length > 80) return DEFAULT_TOKEN
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return DEFAULT_TOKEN
  return token
}

function configuredEndpoint(request: NextRequest): string {
  const fromEnv = process.env.EBAY_NOTIFICATION_ENDPOINT?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, "")

  const site = getSiteUrl().replace(/\/$/, "")
  const path = new URL(request.url).pathname
  if (site) return `${site}${path}`

  // Stable fallback matching what we tell users to paste into eBay.
  return DEFAULT_ENDPOINT
}

function challengeResponse(challengeCode: string, token: string, endpoint: string): string {
  const hash = createHash("sha256")
  hash.update(challengeCode)
  hash.update(token)
  hash.update(endpoint)
  return hash.digest("hex")
}

/** eBay ownership challenge: GET ?challenge_code=… */
export async function GET(request: NextRequest) {
  const token = verificationToken()
  const challengeCode = new URL(request.url).searchParams.get("challenge_code")?.trim()
  if (!challengeCode) {
    return NextResponse.json(
      {
        ok: true,
        service: "ebay-marketplace-account-deletion",
        endpoint: configuredEndpoint(request),
        hint: "Paste this endpoint + verification token into eBay Notifications, then Save.",
      },
      { status: 200 },
    )
  }

  const endpoint = configuredEndpoint(request)
  const responseHash = challengeResponse(challengeCode, token, endpoint)

  return NextResponse.json(
    { challengeResponse: responseHash },
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  )
}

/** Deletion notices — acknowledge immediately (we do not store eBay user PII). */
export async function POST(request: NextRequest) {
  // Always ACK first so eBay does not mark the endpoint down.
  try {
    const body = (await request.json().catch(() => null)) as {
      notification?: { data?: { userId?: string; username?: string } }
    } | null
    const userId = body?.notification?.data?.userId
    if (userId) {
      console.info("[ebay-account-deletion] acknowledged (no local eBay PII to purge)", {
        userId,
      })
    }
  } catch {
    // ignore parse errors — still ACK
  }

  return new NextResponse(null, { status: 204 })
}
