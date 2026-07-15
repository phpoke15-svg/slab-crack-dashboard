"use client"

/** Sync local SlabCrack / SlabLab watchlist to the server for price alerts. */
export async function syncWatchlistToServer(
  tool: "slabcrack" | "slablab",
  items: Array<{ watchlistId: string; cardName: string }>,
): Promise<void> {
  try {
    await fetch("/api/watchlist/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, items }),
    })
  } catch {
    // Best-effort — local watchlist still works offline.
  }
}
