import { readFile, writeFile, mkdir } from "fs/promises"
import path from "path"
import type { SlabLabCard } from "@/lib/slablab-card"

export type SlabItTopCache = {
  syncedAt: string
  cards: SlabLabCard[]
}

const CACHE_PATH = path.join(process.cwd(), "data", "slabit-top-cache.json")

export async function readSlabItTopCache(): Promise<SlabItTopCache | null> {
  try {
    const raw = await readFile(CACHE_PATH, "utf-8")
    const parsed = JSON.parse(raw) as SlabItTopCache
    if (!parsed?.syncedAt || !Array.isArray(parsed.cards)) return null
    return parsed
  } catch {
    return null
  }
}

export async function writeSlabItTopCache(cards: SlabLabCard[]): Promise<SlabItTopCache> {
  const payload: SlabItTopCache = {
    syncedAt: new Date().toISOString(),
    cards,
  }
  await mkdir(path.dirname(CACHE_PATH), { recursive: true })
  await writeFile(CACHE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf-8")
  return payload
}
