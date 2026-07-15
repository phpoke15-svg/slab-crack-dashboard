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

  const context = await openMonitorContext({
    profileDir: config.profileDir,
    proxyServer: config.proxyServer || undefined,
    headed: true,
  })

  const page = context.pages()[0] ?? (await context.newPage())
  await page.goto(POKEMON_CENTER_URL, { waitUntil: "domcontentloaded" })

  console.log("")
  console.log("Complete the Imperva checkbox / image CAPTCHA in the browser window.")
  console.log("When pokemoncenter.com loads normally, press Enter here to save and exit.")
  console.log("")

  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve())
  })

  await context.close()
  console.log("[bootstrap] Saved. Deploy this profile folder to your cloud worker volume.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
