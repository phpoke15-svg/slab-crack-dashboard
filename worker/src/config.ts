import dotenv from "dotenv"

dotenv.config()

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback
}

function proxyEnv(primary: string, legacy: string): string {
  return optional(primary) || optional(legacy)
}

function requiredProxy(primary: string, legacy: string): string {
  const value = proxyEnv(primary, legacy)
  if (!value) {
    throw new Error(`Missing required env var: ${primary} or ${legacy}`)
  }
  return value
}

export const config = {
  targetUrl: optional("TARGET_URL", "https://www.pokemoncenter.com/"),
  queueDeepLink: optional("QUEUE_DEEP_LINK", "https://www.pokemoncenter.com/"),
  fcmTopic: optional("FCM_TOPIC", "pokemon_center_alerts"),
  firebaseServiceAccountJson: optional("FIREBASE_SERVICE_ACCOUNT_JSON"),
  firebaseServiceAccountPath: optional("FIREBASE_SERVICE_ACCOUNT_PATH", "./firebase-service-account.json"),
  subscribePort: Number(optional("PORT", optional("SUBSCRIBE_PORT", "8787"))),
  userAgent:
    optional(
      "USER_AGENT",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    ),
  proxy: {
    host: requiredProxy("IPROYAL_HOST", "PROXY_HOST"),
    port: Number(requiredProxy("IPROYAL_PORT", "PROXY_PORT")),
    username: proxyEnv("IPROYAL_USER", "PROXY_USERNAME"),
    password: proxyEnv("IPROYAL_PASS", "PROXY_PASSWORD"),
  },
}

/** Build IPRoyal/PROXY URL for got-scraping `proxyUrl`. */
export function buildProxyUrl(): string {
  const { host, port, username, password } = config.proxy
  if (username && password) {
    return `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`
  }
  return `http://${host}:${port}`
}
