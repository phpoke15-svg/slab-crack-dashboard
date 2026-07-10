import { NextResponse } from "next/server"
import { isWebPushConfigured } from "@/lib/push/web-push"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: "Web Push is not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT." },
      { status: 503 },
    )
  }

  return NextResponse.json({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
  })
}
