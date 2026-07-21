import { Redis } from "@upstash/redis"
import { normalizeSearchCleanName } from "@/lib/db/catalog-search-local"

const SEARCH_CACHE_PREFIX = "search:pokemon:"

let redisClient: Redis | null | undefined

function redisRestUrl(): string | null {
  return (
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim() ||
    null
  )
}

function redisRestToken(): string | null {
  return (
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim() ||
    null
  )
}

export function isSearchRedisConfigured(): boolean {
  return Boolean(redisRestUrl() && redisRestToken())
}

export function getSearchRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient

  const url = redisRestUrl()
  const token = redisRestToken()
  if (!url || !token) {
    redisClient = null
    return redisClient
  }

  redisClient = new Redis({ url, token })
  return redisClient
}

export function buildSearchRedisKey(cleanName: string): string {
  const normalized = normalizeSearchCleanName(cleanName)
  return `${SEARCH_CACHE_PREFIX}${normalized}`
}

export async function purgeSearchRedisCache(cleanName: string): Promise<boolean> {
  const client = getSearchRedisClient()
  const key = buildSearchRedisKey(cleanName)
  if (!client || !key) return false

  try {
    await client.del(key)
    return true
  } catch (error) {
    console.warn("[search-redis] purge failed:", key, error)
    return false
  }
}

export async function getSearchRedisCache<T>(cleanName: string): Promise<T | null> {
  const client = getSearchRedisClient()
  const key = buildSearchRedisKey(cleanName)
  if (!client || !key) return null

  try {
    return (await client.get<T>(key)) ?? null
  } catch (error) {
    console.warn("[search-redis] get failed:", key, error)
    return null
  }
}

export async function setSearchRedisCache<T>(
  cleanName: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  const client = getSearchRedisClient()
  const key = buildSearchRedisKey(cleanName)
  if (!client || !key) return

  try {
    await client.set(key, value, { ex: ttlSeconds })
  } catch (error) {
    console.warn("[search-redis] set failed:", key, error)
  }
}
