export const POKEMON_CENTER_URL = "https://www.pokemoncenter.com/"

export function loadConfig() {
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
