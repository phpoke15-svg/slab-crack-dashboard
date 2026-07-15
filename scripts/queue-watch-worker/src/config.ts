import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

export const POKEMON_CENTER_URL = "https://www.pokemoncenter.com/"

/** Load `.env` from cwd when vars are not already exported (local bootstrap). */
export function loadDotEnv(path = resolve(process.cwd(), ".env")) {
  if (!existsSync(path)) return
  const text = readFileSync(path, "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

export function loadConfig() {
  loadDotEnv()
  const collectoolsUrl = (process.env.COLLECTOOLS_URL || "https://www.collectools.app").replace(
    /\/$/,
    "",
  )
  const workerSecret = process.env.QUEUE_WATCH_WORKER_SECRET?.trim() || ""
  const sessionId = process.env.SESSION_ID?.trim() || "remote-monitor-fly"
  const profileDir = process.env.PROFILE_DIR?.trim() || "./pc-profile"
  const pollMs = Number(process.env.POLL_MS || 15_000)
  const proxyServer = process.env.PROXY_SERVER?.trim() || ""
  const forceWindow = process.env.FORCE_DROP_WINDOW === "1"

  if (!workerSecret) {
    throw new Error("QUEUE_WATCH_WORKER_SECRET is required")
  }

  return {
    collectoolsUrl,
    workerSecret,
    sessionId,
    profileDir,
    pollMs: Number.isFinite(pollMs) && pollMs >= 5_000 ? pollMs : 15_000,
    proxyServer,
    forceWindow,
  }
}
