/** Remote Playwright worker session ids accepted with QUEUE_WATCH_WORKER_SECRET. */
export const QUEUE_WATCH_WORKER_SESSION_PREFIX = "remote-monitor"

export function isQueueWatchWorkerSessionId(sessionId: string): boolean {
  return (
    sessionId === QUEUE_WATCH_WORKER_SESSION_PREFIX ||
    sessionId.startsWith(`${QUEUE_WATCH_WORKER_SESSION_PREFIX}-`)
  )
}

export function isQueueWatchWorkerSecretConfigured(): boolean {
  return Boolean(process.env.QUEUE_WATCH_WORKER_SECRET?.trim())
}

export function verifyQueueWatchWorkerSecret(request: Request): boolean {
  const expected = process.env.QUEUE_WATCH_WORKER_SECRET?.trim()
  if (!expected) return false
  const auth = request.headers.get("authorization")?.trim()
  return auth === `Bearer ${expected}`
}
