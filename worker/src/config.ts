import dotenv from "dotenv"

dotenv.config()

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback
}

export const config = {
  targetUrl: optional("TARGET_URL", "https://www.pokemoncenter.com/"),
  queueDeepLink: optional("QUEUE_DEEP_LINK", "https://www.pokemoncenter.com/"),
  fcmTopic: optional("FCM_TOPIC", "pokemon_center_alerts"),
  firebaseServiceAccountPath: required("FIREBASE_SERVICE_ACCOUNT_PATH"),
  subscribePort: Number(optional("SUBSCRIBE_PORT", "8787")),
  userAgent:
    optional(
      "USER_AGENT",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    ),
  proxy: {
    host: required("PROXY_HOST"),
    port: Number(required("PROXY_PORT")),
    username: optional("PROXY_USERNAME"),
    password: optional("PROXY_PASSWORD"),
  },
}

export function buildProxyUrl(): string {
  const { host, port, username, password } = config.proxy
  if (username && password) {
    return `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`
  }
  return `http://${host}:${port}`
}
