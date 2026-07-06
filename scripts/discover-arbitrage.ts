/**
 * Scan PriceCharting's full Pokemon market for slab < raw arbitrage.
 *
 * Usage:
 *   npm run discover-arbitrage
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { discoverArbitrageFromMarket } from "../lib/discover-arbitrage"

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

  const result = await discoverArbitrageFromMarket({
    onProgress: (msg) => console.log(msg),
  })

  console.log("\n[discover] Done.")
  console.log(`  Source:           ${result.source}`)
  console.log(`  Products scanned: ${result.scanned}`)
  console.log(`  Arbitrage found:  ${result.arbitrageFound}`)
  console.log(`  Saved to DB:      ${result.saved}`)
  console.log(`  Top deficit:      $${result.topDeficit.toFixed(2)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
