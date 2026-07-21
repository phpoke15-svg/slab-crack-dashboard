/**
 * Register hydration jobs for every seeded expansion in catalog_cards.
 * Run once after seed-scrydex-from-cards — no Scrydex API credits.
 *
 * Usage:
 *   npx tsx scripts/scrydex-queue-seeded-expansions.ts
 *   npx tsx scripts/scrydex-queue-seeded-expansions.ts --status
 */

import { readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  countHydrationProgress,
  registerSeededExpansionJobs,
} from "@/lib/scrydex/hydration-queue"

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

async function main() {
  await loadEnvFile(".env")
  await loadEnvFile(".env.local", true)

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  const showStatus = process.argv.includes("--status")
  if (showStatus) {
    const progress = await countHydrationProgress("pokemon")
    console.log("[scrydex-queue] Pokemon hydration progress:", progress)
    return
  }

  const registered = await registerSeededExpansionJobs({ game: "pokemon" })
  console.log(`[scrydex-queue] Registered ${registered} pokemon expansion jobs`)

  const progress = await countHydrationProgress("pokemon")
  console.log("[scrydex-queue] Progress:", progress)
}

main().catch((error) => {
  console.error("[scrydex-queue] failed:", error)
  process.exit(1)
})
