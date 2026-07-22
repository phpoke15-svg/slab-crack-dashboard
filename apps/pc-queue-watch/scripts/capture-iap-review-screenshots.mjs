/**
 * App Store Connect subscription review screenshots (Premium + Pro).
 * Mimics the iOS app WebView (hides Google Play badges via html.native-app).
 *
 * Usage (repo root):
 *   node apps/pc-queue-watch/scripts/capture-iap-review-screenshots.mjs
 */
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const { chromium, devices } = require(join(root, "node_modules", "playwright"))
const sharp = require(join(root, "node_modules", "sharp"))

const OUT = join(root, "apps", "pc-queue-watch", "store-assets", "iap-review")
mkdirSync(OUT, { recursive: true })

/** iPhone 6.7" — App Store Connect subscription screenshot slot. */
const W = 1290
const H = 2796
const BASE = process.env.CAPTURE_BASE_URL?.trim() || "https://www.collectools.app"

const PLANS = [
  {
    file: "collectools-premium-plan",
    heading: "CollecTools Premium",
    productId: "collectools_premium_monthly",
  },
  {
    file: "collectools-pro-plan",
    heading: "CollecTools Pro",
    productId: "collectools_pro_monthly",
  },
]

async function toPhoneCanvas(inputBuffer) {
  const meta = await sharp(inputBuffer).metadata()
  const srcW = meta.width ?? W
  const srcH = meta.height ?? H
  const maxW = Math.round(W * 0.92)
  const maxH = Math.round(H * 0.72)
  const scale = Math.min(maxW / srcW, maxH / srcH, 1)
  const targetW = Math.round(srcW * scale)
  const targetH = Math.round(srcH * scale)

  const card = await sharp(inputBuffer)
    .resize(targetW, targetH, { fit: "inside" })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: 11, g: 14, b: 20 },
    },
  })
    .composite([{ input: card, top: Math.round((H - targetH) * 0.22), left: Math.round((W - targetW) / 2) }])
    .png()
    .toBuffer()
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    ...devices["iPhone 15 Pro Max"],
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  })

  await context.addInitScript(() => {
    document.documentElement.classList.add("native-app")
  })

  const page = await context.newPage()
  const url = `${BASE}/pricing#plans`
  console.log(`Loading ${url} (native-app shell)`)
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 }).catch(() =>
    page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 }),
  )
  await page.waitForTimeout(2000)
  await page.locator("#plans").scrollIntoViewIfNeeded().catch(() => null)
  await page.waitForTimeout(800)

  for (const plan of PLANS) {
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: plan.heading }) })
    await card.first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(600)
    const shot = await card.first().screenshot({ type: "png" })
    const final = await toPhoneCanvas(shot)
    const outPath = join(OUT, `${plan.file}.png`)
    await sharp(final).toFile(outPath)
    console.log(`→ ${outPath} (${plan.productId})`)
  }

  await browser.close()
  console.log("\nUpload in App Store Connect → Subscriptions → [product] → Review Information → Screenshot")
  console.log(OUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
