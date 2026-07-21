/**
 * One-time (or occasional) backfill of public.expansions from Scrydex.
 *
 * Usage:
 *   npm run scrydex-sync-expansions
 *   npm run scrydex-sync-expansions -- --years=5
 *   npm run scrydex-sync-expansions -- --game=pokemon --years=5 --pages=10
 */

import { readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { syncAllExpansions } from "@/lib/scrydex/hydrate"
import type { TcgGame } from "@/lib/scrydex/types"

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

function parseGame(): TcgGame {
  const arg = process.argv.find((entry) => entry.startsWith("--game="))
  const game = arg?.split("=")[1]?.trim() ?? "pokemon"
  if (game === "pokemon" || game === "lorcana" || game === "mtg") return game
  throw new Error(`Unsupported game: ${game}`)
}

async function main() {
  await loadEnvFile(".env")
  await loadEnvFile(".env.local", true)

  if (!process.env.SCRYDEX_API_KEY?.trim() || !process.env.SCRYDEX_TEAM_ID?.trim()) {
    throw new Error("Set SCRYDEX_API_KEY and SCRYDEX_TEAM_ID in .env.local")
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  const game = parseGame()
  const maxAgeYears = parseFlag("years", 5)
  const maxPages = parseFlag("pages", 20)

  console.log(`[scrydex-sync-expansions] ${game} · last ${maxAgeYears} years · up to ${maxPages} pages`)
  const result = await syncAllExpansions(game, { maxAgeYears, pageSize: 100, maxPages })
  console.log("[scrydex-sync-expansions] done:", result)
}

main().catch((error) => {
  console.error("[scrydex-sync-expansions] failed:", error instanceof Error ? error.message : error)
  process.exit(1)
})
