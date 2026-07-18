import { buildQueueWatchBookmarklet } from "../../../../lib/pokemon-center/bookmarklet"
import { COLLECTOOLS_BASE_URL } from "../config"

export function buildInstallBookmarklet(sessionId: string, token: string): string {
  return buildQueueWatchBookmarklet({
    origin: COLLECTOOLS_BASE_URL,
    sessionId,
    token,
  })
}

export function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
