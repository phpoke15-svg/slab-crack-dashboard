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
 * Env: EBAY_NOTIFICATION_VERIFICATION_TOKEN (32–80 chars: A–Z a–z 0–9 _ -)
 */

function verificationToken(): string | null {
  const token = process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN?.trim()
  if (!token) return null
  if (token.length < 32 || token.length > 80) return null
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null
  return token
}

function configuredEndpoint(request: NextRequest): string {
  const fromEnv = process.env.EBAY_NOTIFICATION_ENDPOINT?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, "")

  const url = new URL(request.url)
  // Prefer canonical site URL so the hash matches what you paste into eBay.
  const site = getSiteUrl().replace(/\/$/, "")
  if (site) return `${site}${url.pathname}`
  return `${url.origin}${url.pathname}`
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
  if (!token) {
    return NextResponse.json(
      {
        error:
          "Set EBAY_NOTIFICATION_VERIFICATION_TOKEN (32–80 alphanumeric/_/- chars) on Vercel, then redeploy.",
      },
      { status: 503 },
    )
  }

  const challengeCode = new URL(request.url).searchParams.get("challenge_code")?.trim()
  if (!challengeCode) {
    return NextResponse.json(
      {
        ok: true,
        service: "ebay-marketplace-account-deletion",
        hint: "eBay will call this URL with ?challenge_code=… during subscription.",
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
