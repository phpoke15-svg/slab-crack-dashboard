type SearchCachePayload = {
  results: unknown[]
  catalogSource?: string
  catalogReady?: boolean
}

const MEMORY_TTL_MS = 30_000
const memoryCache = new Map<string, { payload: SearchCachePayload; expiresAt: number }>()

function cacheKey(query: string): string {
  return `search:${query.toLowerCase().trim()}`
}

async function upstashGet(key: string): Promise<string | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return null

  const response = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!response.ok) return null
  const data = (await response.json()) as { result?: string | null }
  return data.result ?? null
}

async function upstashSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) return

  await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${ttlSeconds}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
}

export function searchCacheTtlSeconds(): number {
  const raw = Number(process.env.SEARCH_CACHE_TTL_SECONDS ?? 300)
  return Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 900) : 300
}

export async function getCachedSearchPayload(query: string): Promise<SearchCachePayload | null> {
  const key = cacheKey(query)

  const memory = memoryCache.get(key)
  if (memory && memory.expiresAt > Date.now()) {
    return memory.payload
  }

  try {
    const remote = await upstashGet(key)
    if (remote) {
      const payload = JSON.parse(remote) as SearchCachePayload
      memoryCache.set(key, { payload, expiresAt: Date.now() + MEMORY_TTL_MS })
      return payload
    }
  } catch {
    // ignore corrupt cache entries
  }

  return null
}

export async function setCachedSearchPayload(query: string, payload: SearchCachePayload): Promise<void> {
  const key = cacheKey(query)
  const ttl = searchCacheTtlSeconds()

  memoryCache.set(key, { payload, expiresAt: Date.now() + MEMORY_TTL_MS })

  try {
    await upstashSet(key, JSON.stringify(payload), ttl)
  } catch {
    // Redis optional — memory cache still helps warm lambdas
  }
}
