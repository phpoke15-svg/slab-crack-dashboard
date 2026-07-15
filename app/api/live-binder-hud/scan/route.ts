import { NextResponse } from "next/server"
import { scanBinderPage } from "@/lib/live-binder-hud/scan-page"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      pockets?: Array<{ slot?: number; image?: string }>
    }
    const pockets = body.pockets
    if (!Array.isArray(pockets) || pockets.length === 0) {
      return NextResponse.json({ ok: false, error: "pockets[] required" }, { status: 400 })
    }
    for (const p of pockets) {
      if (!p?.image || String(p.image).length > 4_500_000) {
        return NextResponse.json(
          { ok: false, error: `Pocket ${p?.slot ?? "?"} image too large or missing` },
          { status: 400 },
        )
      }
    }
    const result = await scanBinderPage(
      pockets.map((p) => ({ slot: Number(p.slot), image: String(p.image) })),
    )
    return NextResponse.json({ ok: true, cards: result.cards, model: result.model })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed"
    const status = /not configured/i.test(message) ? 503 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
