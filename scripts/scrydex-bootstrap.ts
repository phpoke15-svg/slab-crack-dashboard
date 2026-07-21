/**
 * Run Scrydex hydration + price sync locally (manual bootstrap).
 *
 * Usage:
 *   npx tsx scripts/scrydex-bootstrap.ts --hydrate --pages=10
 *   npx tsx scripts/scrydex-bootstrap.ts --prices --max=400
 *   npx tsx scripts/scrydex-bootstrap.ts --hydrate --prices --pages=5 --max=200
 *
 * Requires SCRYDEX_API_KEY + SCRYDEX_TEAM_ID in .env.local
 */

import { readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { hydrateExpansionPage } from "@/lib/scrydex/hydrate"
import { countHydrationProgress, pickNextHydrationJob } from "@/lib/scrydex/hydration-queue"
import { syncScrydexPrices } from "@/lib/scrydex/price-sync"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

async function loadEnvFile(relativePath: string, override = false) {
  const path = join(root, relativePath)
  if (!existsSync(path)) return

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

function parseFlag(name: string, fallback: number): number {
  const arg = process.argv.find((entry) => entry.startsWith(`--${name}=`))
  if (!arg) return fallback
  const parsed = Number(arg.split("=")[1])
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

async function main() {
  await loadEnvFile(".env")
  await loadEnvFile(".env.local", true)

  if (!process.env.SCRYDEX_API_KEY || !process.env.SCRYDEX_TEAM_ID) {
    throw new Error("Set SCRYDEX_API_KEY and SCRYDEX_TEAM_ID in .env.local")
  }

  const runHydrate = process.argv.includes("--hydrate")
  const runPrices = process.argv.includes("--prices")
  const includePrices = process.argv.includes("--with-prices")
  const pages = parseFlag("pages", 5)
  const maxCards = parseFlag("max", 400)

  if (!runHydrate && !runPrices) {
    console.error("Usage: npx tsx scripts/scrydex-bootstrap.ts [--hydrate] [--prices] [--pages=5] [--max=400] [--with-prices]")
    process.exit(1)
  }

  if (runHydrate) {
    const job = await pickNextHydrationJob("pokemon")
    if (!job) {
      console.log("[scrydex-bootstrap] No pending hydration jobs")
    } else {
      console.log(`[scrydex-bootstrap] Hydrating ${job.game}/${job.expansionId} (${job.status})`)
      const result = await hydrateExpansionPage({
        game: job.game,
        expansionId: job.expansionId,
        includePrices,
        maxPages: pages,
      })
      console.log("[scrydex-bootstrap] Hydrate result:", result)
    }

    const progress = await countHydrationProgress("pokemon")
    console.log("[scrydex-bootstrap] Hydration progress:", progress)
  }

  if (runPrices) {
    console.log(`[scrydex-bootstrap] Syncing up to ${maxCards} stale prices from Scrydex...`)
    const result = await syncScrydexPrices({ maxCards, includeHistory: false })
    console.log("[scrydex-bootstrap] Price sync result:", result)
  }
}

main().catch((error) => {
  console.error("[scrydex-bootstrap] failed:", error)
  process.exit(1)
})
