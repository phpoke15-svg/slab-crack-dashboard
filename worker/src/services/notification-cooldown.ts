import { Redis } from "@upstash/redis"
import { config } from "../config.js"

const memoryLocks = new Map<string, number>()

let redisClient: Redis | null | undefined

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient

  const url = config.upstashRedisRestUrl
  const token = config.upstashRedisRestToken
  if (!url || !token) {
    redisClient = null
    return redisClient
  }

  redisClient = new Redis({ url, token })
  return redisClient
}

function claimMemoryCooldown(key: string, ttlMs: number, now = Date.now()): boolean {
  const expiresAt = memoryLocks.get(key)
  if (expiresAt != null && expiresAt > now) return false

  memoryLocks.set(key, now + ttlMs)
  return true
}

async function claimRedisCooldown(key: string, ttlMs: number): Promise<boolean> {
  const redis = getRedisClient()
  if (!redis) return claimMemoryCooldown(key, ttlMs)

  try {
    const result = await redis.set(key, "1", {
      nx: true,
      px: ttlMs,
    })
    if (result === "OK") return true
    return false
  } catch (error) {
    console.warn("[notification] Redis cooldown fallback to memory:", error)
    return claimMemoryCooldown(key, ttlMs)
  }
}

/** Returns true when this caller wins the cooldown slot (may send). */
export async function claimNotificationCooldown(
  key: string,
  ttlMs = config.notificationCooldownMs,
): Promise<boolean> {
  return claimRedisCooldown(`notification:cooldown:${key}`, ttlMs)
}

export async function publishQueueDetectedEvent(payload: string): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return

  try {
    await redis.publish(config.notificationRedisChannel, payload)
  } catch (error) {
    console.warn("[notification] Redis publish failed:", error)
  }
}

export function resetNotificationCooldownForTests(): void {
  memoryLocks.clear()
  redisClient = undefined
}
