import type { BrowserContext, Page } from "playwright"
import {
  buildQueueMonitorMainScript,
  QUEUE_MONITOR_EARLY_SCRIPT,
} from "../../../lib/pokemon-center/queue-monitor-script.js"
import { POKEMON_CENTER_URL } from "./config.js"
import type { WorkerScanState } from "./report.js"

const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36"

export async function openMonitorContext(input: {
  profileDir: string
  proxyServer?: string
  headed?: boolean
}): Promise<BrowserContext> {
  const { mkdir } = await import("node:fs/promises")
  await mkdir(input.profileDir, { recursive: true })

  const { chromium } = await import("playwright")
  return chromium.launchPersistentContext(input.profileDir, {
    headless: !input.headed,
    viewport: { width: 390, height: 844 },
    userAgent: MOBILE_UA,
    locale: "en-US",
    timezoneId: "America/New_York",
    proxy: input.proxyServer ? { server: input.proxyServer } : undefined,
    args: ["--disable-blink-features=AutomationControlled"],
  })
}

async function injectMonitor(page: Page) {
  await page.addInitScript(QUEUE_MONITOR_EARLY_SCRIPT)
  await page.addInitScript(buildQueueMonitorMainScript("worker"))
  await page.evaluate(buildQueueMonitorMainScript("worker")).catch(() => {})
}

export async function ensureMonitorPage(context: BrowserContext): Promise<Page> {
  const page = context.pages()[0] ?? (await context.newPage())
  if (!page.url().startsWith("https://www.pokemoncenter.com")) {
    await page.goto(POKEMON_CENTER_URL, { waitUntil: "domcontentloaded", timeout: 60_000 })
  }
  await injectMonitor(page)
  await page.waitForTimeout(2_500)
  return page
}

export async function readMonitorState(page: Page): Promise<WorkerScanState | null> {
  const raw = await page.evaluate(() => {
    return (window as unknown as { __pcWorkerLastReport?: string }).__pcWorkerLastReport ?? null
  })

  if (!raw) {
    return {
      live: false,
      challenge: false,
      confidence: 0,
      signals: [],
      blocked: false,
      pageUrl: page.url(),
      checkedAt: new Date().toISOString(),
    }
  }

  try {
    const data = JSON.parse(raw) as WorkerScanState & { type?: string }
    return {
      live: Boolean(data.live),
      challenge: Boolean(data.challenge),
      confidence: typeof data.confidence === "number" ? data.confidence : 0,
      signals: Array.isArray(data.signals) ? data.signals : [],
      blocked: Boolean(data.blocked),
      pageUrl: data.pageUrl || page.url(),
      checkedAt: data.checkedAt || new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export async function refreshMonitorPage(page: Page): Promise<void> {
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 })
  await page.waitForTimeout(2_500)
  await page.evaluate(buildQueueMonitorMainScript("worker")).catch(() => {})
}
