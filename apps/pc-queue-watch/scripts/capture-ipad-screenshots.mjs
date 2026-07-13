/**
 * Capture App Store screenshots for iPad 13" (2064 × 2752 portrait).
 *
 * Usage (from repo root):
 *   node apps/pc-queue-watch/scripts/capture-ipad-screenshots.mjs
 */
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const { chromium } = require(join(root, "node_modules", "playwright"))
const sharp = require(join(root, "node_modules", "sharp"))

const W = 2064
const H = 2752
const BASE = "https://www.collectools.app"
const OUT = join(root, "apps", "pc-queue-watch", "store-assets", "ipad-13")
const RAW = join(OUT, "raw")
mkdirSync(RAW, { recursive: true })
mkdirSync(OUT, { recursive: true })

const PAGES = [
  { file: "01-home", path: "/", wait: "text=SlabCrack" },
  { file: "02-slabcrack", path: "/slabcrack", wait: "body" },
  { file: "03-slablab", path: "/slablab", wait: "body" },
  { file: "04-pokematch", path: "/binder", wait: "body" },
  { file: "05-pokewatch", path: "/pokewatch", wait: "body" },
  { file: "06-pricing", path: "/pricing", wait: "body" },
  { file: "07-signin", path: "/sign-in", wait: "body" },
  { file: "08-home-tools", path: "/", wait: "text=CardLounge", scrollY: 500 },
  { file: "09-slablab-cards", path: "/slablab", wait: "body", scrollY: 700 },
  { file: "10-pricing-plans", path: "/pricing", wait: "body", scrollY: 400 },
]

async function main() {
  const browser = await chromium.launch({ headless: true })
  // iPad Pro 13" CSS viewport @2x → 2064×2752
  const context = await browser.newContext({
    viewport: { width: 1032, height: 1376 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  })
  const page = await context.newPage()

  for (const item of PAGES) {
    const url = `${BASE}${item.path}`
    console.log(`capturing ${item.file} ← ${url}`)
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() =>
      page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }),
    )
    await page.waitForTimeout(1200)
    if (item.wait) await page.waitForSelector(item.wait, { timeout: 15000 }).catch(() => {})
    if (item.scrollY) {
      await page.evaluate((y) => window.scrollTo(0, y), item.scrollY)
      await page.waitForTimeout(400)
    }
    const rawPath = join(RAW, `${item.file}.png`)
    await page.screenshot({ path: rawPath, fullPage: false, type: "png" })
    const outPath = join(OUT, `${item.file}.png`)
    await sharp(rawPath)
      .resize(W, H, {
        fit: "cover",
        position: "top",
        background: { r: 11, g: 14, b: 20, alpha: 1 },
      })
      .png()
      .toFile(outPath)
    const meta = await sharp(outPath).metadata()
    console.log(`  → ${outPath} (${meta.width}x${meta.height})`)
  }

  await browser.close()
  console.log(`\nDone. Upload from:\n${OUT}`)
  console.log("App Store Connect → iPad → 13\" Display → 2064 × 2752")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
