import { NextResponse } from "next/server"
import { getEntitlementsForUser } from "@/lib/billing/stripe"
import { hubToolsForUser } from "@/lib/collectools-tools"
import { normalizeHubToolOrder, parseHubToolOrder } from "@/lib/hub-tool-order"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("hub_tool_order")
    .eq("id", auth.user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const toolOrder = parseHubToolOrder(data?.hub_tool_order)
  return NextResponse.json({
    ok: true,
    toolOrder: toolOrder.length ? toolOrder : null,
  })
}

export async function PUT(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const entitlements = await getEntitlementsForUser(auth.user.id)
  if (!entitlements.customHubLayout) {
    return NextResponse.json(
      { ok: false, error: "Custom hub layout is included with CollecTools Pro and Supreme." },
      { status: 403 },
    )
  }

  let body: { toolOrder?: unknown }
  try {
    body = (await request.json()) as { toolOrder?: unknown }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const requested = parseHubToolOrder(body.toolOrder)
  if (!requested.length) {
    return NextResponse.json({ ok: false, error: "toolOrder must be a non-empty array" }, { status: 400 })
  }

  const allowedIds = hubToolsForUser({ supreme: entitlements.supreme }).map((tool) => tool.id)
  const toolOrder = normalizeHubToolOrder(requested, allowedIds)
  if (!toolOrder) {
    return NextResponse.json({ ok: false, error: "Invalid tool order" }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from("profiles")
    .update({
      hub_tool_order: toolOrder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.user.id)

  if (error) {
    const missingColumn = /hub_tool_order|column/i.test(error.message)
    return NextResponse.json(
      {
        ok: false,
        error: missingColumn
          ? "Database migration required: run supabase/hub-tool-order.sql"
          : error.message,
      },
      { status: missingColumn ? 503 : 500 },
    )
  }

  return NextResponse.json({ ok: true, toolOrder })
}
