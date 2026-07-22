const memoryLocks = new Map<string, number>()

/** Returns true when this caller wins the cooldown slot (may send). */
export function claimCooldown(key: string, ttlMs: number, now = Date.now()): boolean {
  const expiresAt = memoryLocks.get(key)
  if (expiresAt != null && expiresAt > now) return false

  memoryLocks.set(key, now + ttlMs)
  return true
}

export function resetCooldownForTests(): void {
  memoryLocks.clear()
}
