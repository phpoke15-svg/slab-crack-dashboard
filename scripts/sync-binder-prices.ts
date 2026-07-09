/**
 * Refresh PokeMatch binder/search card prices from PriceCharting.
 *
 * Usage:
 *   npm run sync-binder-prices
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

async function loadEnvLocal() {
  try {
    const raw = await readFile(join(root, ".env.local"), "utf-8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    /* optional */
  }
}

async function main() {
  await loadEnvLocal()

  const { syncBinderCardPrices } = await import("../lib/sync-binder-prices")
  const result = await syncBinderCardPrices({ force: true })

  console.log(
    `[sync-binder-prices] candidates=${result.candidates} refreshed=${result.refreshed} skipped=${result.skipped} at=${result.syncedAt}`,
  )

  if (result.source === "skipped") {
    console.error("Set PRICECHARTING_API_KEY in .env.local")
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
