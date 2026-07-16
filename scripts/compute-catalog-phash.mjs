/**
 * Backfill perceptual hashes on slab_cards from catalog images.
 *
 * Prerequisites:
 *   1. Run supabase/scanner-phash.sql in Supabase SQL Editor
 *   2. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage:
 *   node scripts/compute-catalog-phash.mjs
 *   node scripts/compute-catalog-phash.mjs --limit 50
 *   node scripts/compute-catalog-phash.mjs --force
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import sharp from "sharp"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const HASH_W = 9
const HASH_H = 8

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

function sampleGrayGrid(rgba, srcW, srcH, gridW, gridH) {
  const out = new Float32Array(gridW * gridH)
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const sx = Math.min(srcW - 1, Math.floor((gx / gridW) * srcW))
      const sy = Math.min(srcH - 1, Math.floor((gy / gridH) * srcH))
      const o = (sy * srcW + sx) * 4
      out[gy * gridW + gx] = rgba[o] * 0.299 + rgba[o + 1] * 0.587 + rgba[o + 2] * 0.114
    }
  }
  return out
}

function dHashFromRgba(rgba, width, height) {
  const gray = sampleGrayGrid(rgba, width, height, HASH_W, HASH_H)
  let hash = 0n
  let bit = 0n
  for (let y = 0; y < HASH_H; y++) {
    for (let x = 0; x < HASH_W - 1; x++) {
      if (gray[y * HASH_W + x] > gray[y * HASH_W + x + 1]) {
        hash |= 1n << bit
      }
      bit += 1n
    }
  }
  return hash.toString(16).padStart(16, "0")
}

async function phashFromUrl(url) {
  const res = await fetch(url, {
    headers: { Accept: "image/*" },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const { data, info } = await sharp(buf)
    .resize(128, 180, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return dHashFromRgba(data, info.width, info.height)
}

function parseArgs(argv) {
  const limitIdx = argv.indexOf("--limit")
  const limit = limitIdx >= 0 ? Number(argv[limitIdx + 1]) : null
  const force = argv.includes("--force")
  return { limit: Number.isFinite(limit) && limit > 0 ? limit : null, force }
}

await loadEnvLocal()

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const { limit, force } = parseArgs(process.argv.slice(2))
const supabase = createClient(url, key)

let query = supabase
  .from("slab_cards")
  .select("id, name, image_large, image_small, phash")
  .order("updated_at", { ascending: false })

if (!force) query = query.is("phash", null)

const { data: rows, error } = await query.limit(limit ?? 10_000)
if (error) {
  console.error("Query failed:", error.message)
  process.exit(1)
}

const cards = rows ?? []
console.log(`Processing ${cards.length} catalog cards${force ? " (force)" : ""}…`)

let updated = 0
let skipped = 0
let failed = 0

for (const row of cards) {
  const imageUrl = row.image_large || row.image_small
  if (!imageUrl) {
    skipped += 1
    continue
  }

  try {
    const phash = await phashFromUrl(imageUrl)
    const { error: upErr } = await supabase.from("slab_cards").update({ phash }).eq("id", row.id)
    if (upErr) throw new Error(upErr.message)
    updated += 1
    if (updated % 25 === 0) console.log(`  ${updated} updated…`)
  } catch (err) {
    failed += 1
    console.warn(`  skip ${row.id} (${row.name}):`, err instanceof Error ? err.message : err)
  }
}

console.log(`Done. updated=${updated} skipped=${skipped} failed=${failed}`)
