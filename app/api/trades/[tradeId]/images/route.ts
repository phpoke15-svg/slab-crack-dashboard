import { NextRequest, NextResponse } from "next/server"
import { addTradeMessage, uploadChatImage } from "@/lib/trade-binder/trade-messages"
import { getTradeById } from "@/lib/trade-binder/trades"
import { requireUser } from "@/lib/trade-binder/supabase/route-auth"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
) {
  const auth = await requireUser()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { tradeId } = await params
  const trade = await getTradeById(auth.supabase, tradeId, auth.user.id)
  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 })

  const form = await request.formData()
  const file = form.get("file")
  const caption = (form.get("caption") as string | null)?.trim() ?? ""

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file required" }, { status: 400 })
  }

  const { path, error: uploadError } = await uploadChatImage(
    auth.supabase,
    tradeId,
    auth.user.id,
    file,
  )
  if (uploadError || !path) {
    return NextResponse.json({ error: uploadError ?? "Upload failed" }, { status: 400 })
  }

  const { message, error } = await addTradeMessage(
    auth.supabase,
    tradeId,
    auth.user.id,
    caption || "Shared a card photo.",
    "image",
    path,
  )

  if (error) return NextResponse.json({ error }, { status: 400 })

  const { data: signed } = await auth.supabase.storage
    .from("chat-images")
    .createSignedUrl(path, 60 * 60 * 24 * 7)

  return NextResponse.json({
    message: message
      ? { ...message, imageUrl: signed?.signedUrl ?? message.imageUrl }
      : null,
  })
}
