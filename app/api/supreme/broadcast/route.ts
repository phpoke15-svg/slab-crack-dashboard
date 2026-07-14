import { NextResponse } from "next/server"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { getSiteUrl } from "@/lib/site-url"
import {
  claimPushAlertDedupe,
  isWebPushConfigured,
  sendWebPushBroadcast,
} from "@/lib/push/web-push"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const TITLE_MAX = 80
const BODY_MAX = 280
/** Soft cooldown so accidental double-clicks don't spam everyone. */
const BROADCAST_COOLDOWN_MS = 15_000

function normalizePathOrUrl(raw: string | undefined): string {
  const fallback = "/"
  if (!raw?.trim()) return fallback
  const value = raw.trim()
  if (value.startsWith("/")) return value.slice(0, 200)
  try {
    const url = new URL(value)
    const site = new URL(getSiteUrl())
    if (url.origin === site.origin || url.hostname.endsWith("collectools.app")) {
      return `${url.pathname}${url.search}`.slice(0, 200) || "/"
    }
  } catch {
    // fall through
  }
  return fallback
}

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }

  const entitlements = await getEntitlementsForUser(auth.user.id)
  if (!entitlements.supreme) {
    return NextResponse.json({ error: "Supreme access required" }, { status: 403 })
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: "Web push is not configured (VAPID keys)." },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const titleRaw =
    body && typeof body === "object" && "title" in body
      ? String((body as { title?: unknown }).title ?? "")
      : ""
  const messageRaw =
    body && typeof body === "object" && "body" in body
      ? String((body as { body?: unknown }).body ?? "")
      : ""
  const urlRaw =
    body && typeof body === "object" && "url" in body
      ? String((body as { url?: unknown }).url ?? "")
      : ""

  const title = titleRaw.trim().slice(0, TITLE_MAX) || "CollecTools"
  const message = messageRaw.trim().slice(0, BODY_MAX)
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 })
  }

  const allowed = await claimPushAlertDedupe("supreme-broadcast-cooldown", BROADCAST_COOLDOWN_MS)
  if (!allowed) {
    return NextResponse.json(
      { error: "Wait a few seconds before sending another broadcast." },
      { status: 429 },
    )
  }

  const path = normalizePathOrUrl(urlRaw)
  const result = await sendWebPushBroadcast({
    title,
    body: message,
    url: path,
    tag: `supreme-broadcast-${Date.now()}`,
  })

  return NextResponse.json({
    ok: !result.skipped,
    ...result,
    title,
    body: message,
    url: path,
    sentAt: new Date().toISOString(),
  })
}
