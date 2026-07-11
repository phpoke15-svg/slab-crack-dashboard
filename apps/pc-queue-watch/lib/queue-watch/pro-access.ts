import AsyncStorage from "@react-native-async-storage/async-storage"
import { COLLECTOOLS_BASE_URL } from "../config"

const TOKEN_KEY = "collectools-qw-token"
const SESSION_KEY = "collectools-qw-session"

export async function getStoredQueueWatchToken(): Promise<string | null> {
  const token = (await AsyncStorage.getItem(TOKEN_KEY))?.trim()
  return token || null
}

export async function clearQueueWatchToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY)
}

/**
 * Pro access for native Queue Watch = a valid bookmarklet token
 * minted only for Pro users on the CollecTools site.
 *
 * Online: verifies against /api/pokemon-center/status (403 = not Pro / expired).
 * Offline: trusts a previously stored token so Pro users aren't locked out.
 */
export async function verifyProAccess(): Promise<{
  hasPro: boolean
  reason: "ok" | "no_token" | "forbidden" | "offline_token"
}> {
  const token = await getStoredQueueWatchToken()
  if (!token) return { hasPro: false, reason: "no_token" }

  try {
    const res = await fetch(
      `${COLLECTOOLS_BASE_URL}/api/pokemon-center/status?token=${encodeURIComponent(token)}`,
      { method: "GET", headers: { "X-Queue-Watch-Token": token } },
    )
    if (res.status === 403 || res.status === 401) {
      await clearQueueWatchToken()
      return { hasPro: false, reason: "forbidden" }
    }
    if (res.ok) return { hasPro: true, reason: "ok" }
    // Transient server error — keep token, allow if we already had one
    return { hasPro: true, reason: "offline_token" }
  } catch {
    return { hasPro: true, reason: "offline_token" }
  }
}

export { TOKEN_KEY, SESSION_KEY }
