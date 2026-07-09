import { NextRequest, NextResponse } from "next/server"
import {
  blockUser,
  listBlockRelations,
  unblockUser,
} from "@/lib/trade-binder/blocks"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const relations = await listBlockRelations(auth.supabase, auth.user.id)
  return NextResponse.json(relations)
}

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const userId = body.userId as string | undefined
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })
  if (userId === auth.user.id) return NextResponse.json({ error: "Invalid user" }, { status: 400 })

  const { error } = await blockUser(auth.supabase, auth.user.id, userId)
  if (error) return NextResponse.json({ error }, { status: 400 })

  const relations = await listBlockRelations(auth.supabase, auth.user.id)
  return NextResponse.json(relations)
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const userId = request.nextUrl.searchParams.get("userId")
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })

  const { error } = await unblockUser(auth.supabase, auth.user.id, userId)
  if (error) return NextResponse.json({ error }, { status: 400 })

  const relations = await listBlockRelations(auth.supabase, auth.user.id)
  return NextResponse.json(relations)
}
