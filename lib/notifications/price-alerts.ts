import "server-only"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { notifyPriceAlert } from "@/lib/notifications/triggers"

const MAJOR_PCT = 10
const MAJOR_ABS = 15

type SnapshotRow = {
  watchlist_id: string
  raw_price: number
  slab_price: number
  snapshot_date: string
}

type WatchlistUserRow = {
  user_id: string
  watchlist_id: string
  card_name: string
  tool: "slabcrack" | "slablab"
}

function isMajorMove(prev: number, next: number): boolean {
  if (prev <= 0 || next <= 0) return false
  const abs = Math.abs(next - prev)
  const pct = (Math.abs(next - prev) / prev) * 100
  return pct >= MAJOR_PCT || abs >= MAJOR_ABS
}

function formatDelta(prev: number, next: number): string {
  const delta = next - prev
  const sign = delta >= 0 ? "+" : ""
  const pct = prev > 0 ? Math.round((delta / prev) * 100) : 0
  return `${sign}$${Math.abs(delta).toFixed(0)} (${sign}${pct}%)`
}

export async function processWatchlistPriceAlerts(): Promise<{
  checked: number
  notified: number
}> {
  if (!isSupabaseConfigured()) return { checked: 0, notified: 0 }

  const admin = createAdminClient()

  const { data: watchers, error: watchError } = await admin
    .from("user_card_watchlist")
    .select("user_id, watchlist_id, card_name, tool")

  if (watchError) {
    if (watchError.message.includes("user_card_watchlist")) {
      return { checked: 0, notified: 0 }
    }
    throw new Error(watchError.message)
  }

  const rows = (watchers ?? []) as WatchlistUserRow[]
  if (rows.length === 0) return { checked: 0, notified: 0 }

  const watchlistIds = [...new Set(rows.map((r) => r.watchlist_id))]
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayDate = yesterday.toISOString().slice(0, 10)

  const { data: snapshots, error: snapError } = await admin
    .from("slab_price_snapshots")
    .select("watchlist_id, raw_price, slab_price, snapshot_date")
    .in("watchlist_id", watchlistIds)
    .eq("grade", 10)
    .in("snapshot_date", [today, yesterdayDate])

  if (snapError) {
    if (snapError.message.includes("slab_price_snapshots")) {
      return { checked: rows.length, notified: 0 }
    }
    throw new Error(snapError.message)
  }

  const byCardDate = new Map<string, SnapshotRow>()
  for (const snap of snapshots ?? []) {
    const key = `${snap.watchlist_id}:${snap.snapshot_date}`
    byCardDate.set(key, snap as SnapshotRow)
  }

  let notified = 0

  for (const row of rows) {
    const prev = byCardDate.get(`${row.watchlist_id}:${yesterdayDate}`)
    const next = byCardDate.get(`${row.watchlist_id}:${today}`)
    if (!prev || !next) continue

    const rawMove = isMajorMove(Number(prev.raw_price), Number(next.raw_price))
    const slabMove = isMajorMove(Number(prev.slab_price), Number(next.slab_price))
    if (!rawMove && !slabMove) continue

    const parts: string[] = []
    if (rawMove) {
      parts.push(`Raw ${formatDelta(Number(prev.raw_price), Number(next.raw_price))}`)
    }
    if (slabMove) {
      parts.push(`PSA 10 ${formatDelta(Number(prev.slab_price), Number(next.slab_price))}`)
    }

    const cardName = row.card_name || "Watchlist card"
    const dedupeKey = `price:${row.user_id}:${row.watchlist_id}:${today}`

    await notifyPriceAlert({
      userId: row.user_id,
      watchlistId: row.watchlist_id,
      cardName,
      tool: row.tool,
      title: `Price move: ${cardName}`,
      body: parts.join(" · "),
      dedupeKey,
    })
    notified += 1
  }

  return { checked: rows.length, notified }
}
