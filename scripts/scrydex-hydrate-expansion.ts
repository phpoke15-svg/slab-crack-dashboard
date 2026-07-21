/**
 * Hydrate Scrydex catalog metadata for one expansion.
 *
 * Usage:
 *   npx tsx scripts/scrydex-hydrate-expansion.ts pokemon sv3pt5
 *   npx tsx scripts/scrydex-hydrate-expansion.ts lorcana ROJ --prices
 */

import { hydrateExpansionPage, syncRecentExpansions } from "../lib/scrydex/hydrate"
import type { TcgGame } from "../lib/scrydex/types"

async function loadEnvFile(relativePath: string, override = false) {
  const { readFile, existsSync } = await import("node:fs/promises")
  const { existsSync: exists } = await import("node:fs")
  const { join, dirname } = await import("node:path")
  const { fileURLToPath } = await import("node:url")
  const root = join(dirname(fileURLToPath(import.meta.url)), "..")
  const path = join(root, relativePath)
  if (!exists(path)) return
  const raw = await readFile(path, "utf-8")
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (!key) continue
    if (override || !process.env[key]?.trim()) process.env[key] = value
  }
}

async function main() {
  await loadEnvFile(".env")
  await loadEnvFile(".env.local", true)

  const game = process.argv[2] as TcgGame | undefined
  const expansionId = process.argv[3]
  const includePrices = process.argv.includes("--prices")

  if (!game || !expansionId) {
    console.error("Usage: npx tsx scripts/scrydex-hydrate-expansion.ts <pokemon|lorcana|mtg> <expansionId> [--prices]")
    process.exit(1)
  }

  if (!process.env.SCRYDEX_API_KEY || !process.env.SCRYDEX_TEAM_ID) {
    console.error("Set SCRYDEX_API_KEY and SCRYDEX_TEAM_ID in .env.local")
    process.exit(1)
  }

  console.log(`[scrydex-hydrate] ${game}/${expansionId} prices=${includePrices}`)
  const delta = await syncRecentExpansions(game, 10)
  console.log("[scrydex-hydrate] recent expansions:", delta)

  const result = await hydrateExpansionPage({ game, expansionId, includePrices, maxPages: 20 })
  console.log("[scrydex-hydrate] done:", result)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
