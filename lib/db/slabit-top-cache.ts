import { readFile, writeFile, mkdir } from "fs/promises"
import path from "path"
import { getSearchRedisClient, isSearchRedisConfigured } from "@/lib/cache/search-redis"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { SlabLabCard } from "@/lib/slablab-card"

export type SlabItTopCache = {
  syncedAt: string
  cards: SlabLabCard[]
}

const CACHE_PATH = path.join(process.cwd(), "data", "slabit-top-cache.json")
const REDIS_KEY = "slabit:top-cache:v1"
const REDIS_TTL_SECONDS = 86_400
const SUPABASE_ROW_ID = "default"

function isReadOnlyFilesystemError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EROFS"
  )
}

async function readSlabItTopCacheFromFile(): Promise<SlabItTopCache | null> {
  try {
    const raw = await readFile(CACHE_PATH, "utf-8")
    const parsed = JSON.parse(raw) as SlabItTopCache
    if (!parsed?.syncedAt || !Array.isArray(parsed.cards)) return null
    return parsed
  } catch {
    return null
  }
}

async function writeSlabItTopCacheToFile(payload: SlabItTopCache): Promise<boolean> {
  try {
    await mkdir(path.dirname(CACHE_PATH), { recursive: true })
    await writeFile(CACHE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf-8")
    return true
  } catch (error) {
    if (isReadOnlyFilesystemError(error)) return false
    throw error
  }
}

async function readSlabItTopCacheFromRedis(): Promise<SlabItTopCache | null> {
  if (!isSearchRedisConfigured()) return null
  const client = getSearchRedisClient()
  if (!client) return null

  try {
    const parsed = await client.get<SlabItTopCache>(REDIS_KEY)
    if (!parsed?.syncedAt || !Array.isArray(parsed.cards)) return null
    return parsed
  } catch (error) {
    console.warn("[slabit-top-cache] redis read failed:", error)
    return null
  }
}

async function writeSlabItTopCacheToRedis(payload: SlabItTopCache): Promise<boolean> {
  if (!isSearchRedisConfigured()) return false
  const client = getSearchRedisClient()
  if (!client) return false

  try {
    await client.set(REDIS_KEY, payload, { ex: REDIS_TTL_SECONDS })
    return true
  } catch (error) {
    console.warn("[slabit-top-cache] redis write failed:", error)
    return false
  }
}

async function readSlabItTopCacheFromSupabase(): Promise<SlabItTopCache | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("slabit_top_cache")
      .select("synced_at, cards")
      .eq("id", SUPABASE_ROW_ID)
      .maybeSingle()

    if (error?.code === "42P01") return null
    if (error) throw error
    if (!data?.synced_at || !Array.isArray(data.cards)) return null

    return {
      syncedAt: String(data.synced_at),
      cards: data.cards as SlabLabCard[],
    }
  } catch (error) {
    console.warn("[slabit-top-cache] supabase read failed:", error)
    return null
  }
}

async function writeSlabItTopCacheToSupabase(payload: SlabItTopCache): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from("slabit_top_cache").upsert({
      id: SUPABASE_ROW_ID,
      synced_at: payload.syncedAt,
      cards: payload.cards,
      updated_at: new Date().toISOString(),
    })

    if (error?.code === "42P01") return false
    if (error) throw error
    return true
  } catch (error) {
    console.warn("[slabit-top-cache] supabase write failed:", error)
    return false
  }
}

export async function readSlabItTopCache(): Promise<SlabItTopCache | null> {
  return (
    (await readSlabItTopCacheFromRedis()) ??
    (await readSlabItTopCacheFromSupabase()) ??
    (await readSlabItTopCacheFromFile())
  )
}

export async function writeSlabItTopCache(cards: SlabLabCard[]): Promise<SlabItTopCache> {
  const payload: SlabItTopCache = {
    syncedAt: new Date().toISOString(),
    cards,
  }

  const persisted =
    (await writeSlabItTopCacheToRedis(payload)) ||
    (await writeSlabItTopCacheToSupabase(payload)) ||
    (await writeSlabItTopCacheToFile(payload))

  if (!persisted) {
    throw new Error(
      "Could not persist SlabIt top cache. Configure Upstash Redis or run supabase/slabit-top-cache.sql.",
    )
  }

  return payload
}
