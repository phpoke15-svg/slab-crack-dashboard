import { loadConfig } from "./config.js"
import { openMonitorContext } from "./browser.js"
import { POKEMON_CENTER_URL } from "./config.js"

/**
 * One-time: opens a real browser so you can pass Imperva manually.
 * Cookies persist in PROFILE_DIR for the headless worker.
 */
async function main() {
  const config = loadConfig()
  console.log(`[bootstrap] profile: ${config.profileDir}`)
  if (config.proxyServer) console.log(`[bootstrap] proxy: ${config.proxyServer}`)

  console.log("[bootstrap] Launching installed Google Chrome (up to 2 min)…")
  const context = await openMonitorContext({
    profileDir: config.profileDir,
    proxyServer: config.proxyServer || undefined,
    headed: true,
    useSystemChrome: true,
  })

  const page = context.pages()[0] ?? (await context.newPage())
  console.log(`[bootstrap] Loading ${POKEMON_CENTER_URL} …`)

  try {
    await page.goto(POKEMON_CENTER_URL, {
      waitUntil: "domcontentloaded",
      timeout: 180_000,
    })
    console.log("[bootstrap] Page loaded.")
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[bootstrap] Navigation slow or timed out (${message})`)
    console.warn("[bootstrap] Chrome should still be open — navigate to pokemoncenter.com manually if needed.")
  }

  console.log("")
  console.log("1) Complete the Imperva checkbox / image CAPTCHA in the Chrome window")
  console.log("2) Wait until the normal Pokemon Center storefront appears")
  console.log("3) Press Enter here to save cookies and exit")
  console.log("")

  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve())
  })

  await context.close()
  console.log("[bootstrap] Saved. Upload pc-profile/ to your Fly volume before deploy.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
