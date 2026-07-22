import AsyncStorage from "@react-native-async-storage/async-storage"
import { SESSION_KEY, TOKEN_KEY } from "./pro-access"
import { createSessionId } from "./build-bookmarklet"

export type StoredQueueWatchCredentials = {
  sessionId: string
  token: string
}

/** Load or mint session id + bookmarklet token from secure storage. */
export async function loadStoredCredentials(): Promise<StoredQueueWatchCredentials> {
  let sessionId = (await AsyncStorage.getItem(SESSION_KEY))?.trim() || ""
  if (!sessionId) {
    sessionId = createSessionId()
    await AsyncStorage.setItem(SESSION_KEY, sessionId)
  }

  const token = (await AsyncStorage.getItem(TOKEN_KEY))?.trim() || ""
  return { sessionId, token }
}
