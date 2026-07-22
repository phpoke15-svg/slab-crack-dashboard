import type { Browser, BrowserContext, Page } from "playwright"
import { chromium } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import { config, getPlaywrightProxy } from "./config.js"
import { analyzeHeadResponse, isQueueRedirectLocation } from "./queue-detector.js"
import { createNavigationFailureProbe, type PokemonCenterProbeResult } from "./probe-utils.js"

const NAV_TIMEOUT_MS = 45_000
const IMPERVA_SETTLE_MS = 5_000
const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

/** Register stealth once on the playwright-extra chromium launcher. */
const stealthPlugin = StealthPlugin()
let stealthPluginRegistered = false

export function ensureStealthChromium(): typeof chromium {
  if (!stealthPluginRegistered) {
    chromium.use(stealthPlugin)
    stealthPluginRegistered = true
    console.log("[worker] playwright-extra chromium configured with puppeteer-extra-plugin-stealth")
  }
  return chromium
}

export { formatProbeError, formatProbeLogLine, createNavigationFailureProbe } from "./probe-utils.js"
export type { PokemonCenterProbeResult } from "./probe-utils.js"

async function closePlaywrightSession(
  page: Page | null,
  context: BrowserContext | null,
  browser: Browser | null,
): Promise<void> {
  if (page) {
    await page.close().catch(() => {})
  }
  if (context) {
    await context.close().catch(() => {})
  }
  if (browser) {
    await browser.close().catch(() => {})
  }
}

async function analyzeCurrentPage(page: Page, documentStatus: number): Promise<PokemonCenterProbeResult> {
  const finalUrl = page.url()
  const title = await page.title()
  const html = (await page.content()).slice(0, 16_384)
  const haystack = `${title}\n${finalUrl}\n${html}`
  const redirectQueue = isQueueRedirectLocation(finalUrl)

  const probe = analyzeHeadResponse(
    redirectQueue ? 302 : documentStatus,
    redirectQueue ? finalUrl : null,
    { html: haystack },
  )

  return {
    ...probe,
    transport: "playwright-stealth",
    profile: "chromium-desktop-stealth",
    title,
  }
}

/** Render Pokémon Center in headless Chromium (stealth) through IPRoyal proxy. */
export async function probePokemonCenterQueue(): Promise<PokemonCenterProbeResult> {
  const stealthChromium = ensureStealthChromium()
  let browser: Browser | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null

  try {
    browser = await stealthChromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    })

    context = await browser.newContext({
      proxy: getPlaywrightProxy(),
      userAgent: DESKTOP_USER_AGENT,
      viewport: { width: 1920, height: 1080 },
      screen: { width: 1920, height: 1080 },
      locale: "en-US",
      timezoneId: "America/New_York",
      colorScheme: "light",
      javaScriptEnabled: true,
    })

    page = await context.newPage()

    let documentStatus = 200
    page.on("response", (response) => {
      const request = response.request()
      if (!request.isNavigationRequest()) return
      if (!request.url().includes("pokemoncenter.com") && !request.url().includes("queue-it")) return
      documentStatus = response.status()
    })

    try {
      await page.goto(config.targetUrl, {
        waitUntil: "networkidle",
        timeout: NAV_TIMEOUT_MS,
      })

      await page.waitForTimeout(IMPERVA_SETTLE_MS)

      return await analyzeCurrentPage(page, documentStatus)
    } catch (error) {
      console.warn("[worker] Navigation timed out or failed, waiting for next cycle:", error)
      return createNavigationFailureProbe()
    }
  } catch (error) {
    console.warn("[worker] Navigation timed out or failed, waiting for next cycle:", error)
    return createNavigationFailureProbe()
  } finally {
    await closePlaywrightSession(page, context, browser)
  }
}
