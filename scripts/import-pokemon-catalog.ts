/**
 * One-time import of the English Pokémon TCG catalog into Supabase `cards`.
 *
 * Prerequisites:
 *   1. Run supabase/cards-catalog.sql in Supabase SQL Editor
 *   2. Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage:
 *   npm run import-pokemon-catalog
 *   npm run import-pokemon-catalog -- --set=base1
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { upsertCatalogCards, type CatalogCardUpsert } from "../lib/db/cards-catalog"
import { formatCatalogCardNumberWithTotal } from "../lib/pricing/catalog-search-query"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const DATA_REPO = "PokemonTCG/pokemon-tcg-data"
const SETS_URL = `https://raw.githubusercontent.com/${DATA_REPO}/master/sets/en.json`
const TREE_URL = `https://api.github.com/repos/${DATA_REPO}/git/trees/master?recursive=1`

type SetInfo = {
  id: string
  name: string
  series?: string
  printedTotal?: number
}

type PokemonTcgDataCard = {
  id: string
  name: string
  number?: string
  rarity?: string
  images?: { large?: string; small?: string }
}

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

function formatSetName(set: SetInfo): string {
  const series = set.series?.trim()
  if (series && !set.name.toLowerCase().startsWith(series.toLowerCase())) {
    return `${series}: ${set.name}`
  }
  return set.name
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "collectools-import" },
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  return (await res.json()) as T
}

async function listCardSetFiles(onlySet?: string): Promise<string[]> {
  const tree = await fetchJson<{ tree?: Array<{ path?: string }> }>(TREE_URL)
  const prefix = "cards/en/"
  const files = (tree.tree ?? [])
    .map((entry) => entry.path ?? "")
    .filter((path) => path.startsWith(prefix) && path.endsWith(".json"))
    .map((path) => path.slice(prefix.length))
    .sort()

  if (onlySet) {
    const wanted = `${onlySet}.json`
    if (!files.includes(wanted)) {
      throw new Error(`Set file not found: cards/en/${wanted}`)
    }
    return [wanted]
  }

  return files
}

function cardFileToRows(
  setId: string,
  setName: string,
  printedTotal: number | undefined,
  cards: PokemonTcgDataCard[],
): CatalogCardUpsert[] {
  return cards.map((card) => ({
    id: `poke-${card.id}`,
    name: card.name,
    set_name: setName,
    set_id: setId,
    number: formatCatalogCardNumberWithTotal(card.number ?? "", printedTotal),
    rarity: card.rarity ?? null,
    image_url: card.images?.large ?? card.images?.small ?? null,
    language: "en" as const,
  }))
}

async function main() {
  await loadEnvLocal()

  const onlySet = process.argv.find((arg) => arg.startsWith("--set="))?.slice("--set=".length)

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local")
    process.exit(1)
  }

  console.log("[import-pokemon-catalog] Loading set metadata…")
  const sets = await fetchJson<SetInfo[]>(SETS_URL)
  const setById = new Map(sets.map((set) => [set.id, set]))

  const files = await listCardSetFiles(onlySet)
  console.log(`[import-pokemon-catalog] Importing ${files.length} set file(s)…`)

  let totalCards = 0
  const chunkSize = 400

  for (const file of files) {
    const setId = file.replace(/\.json$/, "")
    const setInfo = setById.get(setId)
    const setName = setInfo ? formatSetName(setInfo) : setId
    const printedTotal = setInfo?.printedTotal
    const url = `https://raw.githubusercontent.com/${DATA_REPO}/master/cards/en/${file}`

    const cards = await fetchJson<PokemonTcgDataCard[]>(url)
    const rows = cardFileToRows(setId, setName, printedTotal, cards)

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      await upsertCatalogCards(chunk)
      totalCards += chunk.length
    }

    console.log(`[import-pokemon-catalog] ${setId}: ${rows.length} cards`)
  }

  console.log(`[import-pokemon-catalog] Done — upserted ${totalCards} cards`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
