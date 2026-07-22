import dotenv from "dotenv"

dotenv.config()

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback
}

const portRaw = optional("PORT", optional("SUBSCRIBE_PORT", "8080"))
const parsedPort = Number(portRaw)

export const config = {
  targetUrl: optional("TARGET_URL", "https://www.pokemoncenter.com/"),
  queueDeepLink: optional("QUEUE_DEEP_LINK", "https://www.pokemoncenter.com/"),
  fcmTopic: optional("FCM_TOPIC", "pokemon_center_alerts"),
  /** Paste full Firebase service account JSON (preferred on Railway). */
  firebaseServiceAccountJson: optional("FIREBASE_SERVICE_ACCOUNT_JSON"),
  /** Local file path when JSON env var is not set. */
  firebaseServiceAccountPath: optional("FIREBASE_SERVICE_ACCOUNT_PATH", "./firebase-service-account.json"),
  /** Railway injects PORT; falls back to SUBSCRIBE_PORT for local dev. */
  subscribePort: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 8080,
  userAgent:
    optional(
      "USER_AGENT",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    ),
}

export type ProxyConfig = {
  host: string
  port: number
  username: string
  password: string
}

export function getProxyConfig(): ProxyConfig | null {
  const host = optional("PROXY_HOST")
  const port = Number(optional("PROXY_PORT"))
  if (!host || !Number.isFinite(port) || port <= 0) return null

  return {
    host,
    port,
    username: optional("PROXY_USERNAME"),
    password: optional("PROXY_PASSWORD"),
  }
}

export function hasFirebaseCredentials(): boolean {
  return Boolean(config.firebaseServiceAccountJson || config.firebaseServiceAccountPath)
}

/** Env vars needed before queue probes or FCM subscribe will work. */
export function getMissingEnvVars(): string[] {
  const missing: string[] = []
  if (!getProxyConfig()) {
    if (!optional("PROXY_HOST")) missing.push("PROXY_HOST")
    if (!optional("PROXY_PORT")) missing.push("PROXY_PORT")
  }
  if (!config.firebaseServiceAccountJson) missing.push("FIREBASE_SERVICE_ACCOUNT_JSON")
  return missing
}

export function buildProxyUrl(): string {
  const proxy = getProxyConfig()
  if (!proxy) {
    throw new Error("Missing PROXY_HOST or PROXY_PORT")
  }

  const { host, port, username, password } = proxy
  if (username && password) {
    return `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`
  }
  return `http://${host}:${port}`
}
