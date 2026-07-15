import AsyncStorage from "@react-native-async-storage/async-storage"
import { SESSION_KEY, TOKEN_KEY } from "./pro-access"

export async function saveQueueWatchCredentials(input: {
  sessionId?: string
  token?: string
}): Promise<{ tokenChanged: boolean; hasToken: boolean }> {
  let tokenChanged = false
  let hasToken = Boolean((await AsyncStorage.getItem(TOKEN_KEY))?.trim())

  if (input.sessionId?.trim()) {
    await AsyncStorage.setItem(SESSION_KEY, input.sessionId.trim())
  }

  if (input.token !== undefined) {
    const next = input.token.trim()
    const prev = (await AsyncStorage.getItem(TOKEN_KEY))?.trim() || ""
    if (next) {
      if (next !== prev) tokenChanged = true
      await AsyncStorage.setItem(TOKEN_KEY, next)
      hasToken = true
    } else {
      if (prev) tokenChanged = true
      await AsyncStorage.removeItem(TOKEN_KEY)
      hasToken = false
    }
  }

  return { tokenChanged, hasToken }
}

/** Pull Pro bookmarklet token/session from the CollecTools WebView localStorage. */
export const BRIDGE_INJECT = `
(function(){
  try {
    var sid = localStorage.getItem('pc-queue-watch-session') || '';
    var tok = localStorage.getItem('pc-queue-watch-token') || '';
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'collectools-qw-creds',
      sessionId: sid,
      token: tok
    }));
  } catch (e) {}
  true;
})();
`
