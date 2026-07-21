import { after } from "next/server"
import { NextResponse } from "next/server"
import { processScrydexWebhookEvent, type ScrydexWebhookEvent } from "@/lib/scrydex/webhook-handler"
import {
  isScrydexWebhookConfigured,
  scrydexWebhookSecret,
  verifyScrydexWebhookSignature,
} from "@/lib/scrydex/webhook-signature"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseWebhookEvent(rawBody: string): ScrydexWebhookEvent | null {
  try {
    const parsed = JSON.parse(rawBody) as Partial<ScrydexWebhookEvent>
    if (!parsed || typeof parsed !== "object") return null
    if (typeof parsed.id !== "string" || typeof parsed.name !== "string") return null
    if (!parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) return null
    return {
      id: parsed.id,
      name: parsed.name,
      data: parsed.data as Record<string, unknown>,
    }
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  if (!isScrydexWebhookConfigured()) {
    return NextResponse.json({ error: "SCRYDEX_WEBHOOK_SECRET missing" }, { status: 503 })
  }

  const signature = request.headers.get("x-scrydex-signature")
  const rawBody = await request.text()

  if (!verifyScrydexWebhookSignature(rawBody, signature, scrydexWebhookSecret())) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const event = parseWebhookEvent(rawBody)
  if (!event) {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 })
  }

  after(async () => {
    try {
      await processScrydexWebhookEvent(event)
    } catch (error) {
      console.error("[scrydex-webhook] async processing failed:", event.id, event.name, error)
    }
  })

  return NextResponse.json({ received: true, id: event.id }, { status: 200 })
}
