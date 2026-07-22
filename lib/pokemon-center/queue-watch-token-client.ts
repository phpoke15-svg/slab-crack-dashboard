const TOKEN_KEY = "collectools-qw-token"
const LEGACY_TOKEN_KEY = "pc-queue-watch-token"

/** Mint and persist a Pro queue-watch token for native app bridging + API auth. */
export async function ensureQueueWatchToken(): Promise<string | null> {
  if (typeof window === "undefined") return null

  try {
    const existing =
      localStorage.getItem(TOKEN_KEY)?.trim() ||
      localStorage.getItem(LEGACY_TOKEN_KEY)?.trim()
    if (existing) {
      localStorage.setItem(TOKEN_KEY, existing)
      localStorage.setItem(LEGACY_TOKEN_KEY, existing)
      return existing
    }
  } catch {
    // ignore
  }

  const res = await fetch("/api/billing/queue-watch-token", { method: "POST" })
  if (!res.ok) return null

  const body = (await res.json()) as { token?: string }
  const token = body.token?.trim()
  if (!token) return null

  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(LEGACY_TOKEN_KEY, token)
  } catch {
    // ignore
  }

  const rn = (window as Window & { ReactNativeWebView?: { postMessage: (msg: string) => void } })
    .ReactNativeWebView
  if (rn?.postMessage) {
    rn.postMessage(
      JSON.stringify({
        type: "collectools-qw-creds",
        sessionId: "",
        token,
      }),
    )
  }

  return token
}

export { TOKEN_KEY, LEGACY_TOKEN_KEY }
