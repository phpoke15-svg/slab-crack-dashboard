/**
 * Capture App Store screenshots for CollecTools (WebView app).
 * iPhone 6.5" size: 1242 × 2688 (also accepted: 1284 × 2778)
 *
 * Usage (from repo root):
 *   node apps/pc-queue-watch/scripts/capture-store-screenshots.mjs
 */
import { createRequire } from "node:module"
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const { chromium, devices } = require(join(root, "node_modules", "playwright"))
const sharp = require(join(root, "node_modules", "sharp"))

const OUT = join(root, "apps", "pc-queue-watch", "store-assets")
const RAW = join(OUT, "raw")
const SHOTS = join(OUT, "screenshots")
const PREVIEWS = join(OUT, "previews")
mkdirSync(RAW, { recursive: true })
mkdirSync(SHOTS, { recursive: true })
mkdirSync(PREVIEWS, { recursive: true })

/** iPhone 6.5" App Store size (also accepts 1284×2778). */
const W = 1242
const H = 2688
const BASE = "https://www.collectools.app"

/** 10 store screenshots — order matters for App Store listing. */
const PAGES = [
  { file: "01-home", path: "/", wait: "text=SlabCrack" },
  { file: "02-slabcrack", path: "/slabcrack", wait: "body" },
  { file: "03-slablab", path: "/slablab", wait: "body" },
  { file: "04-pokematch", path: "/binder", wait: "body" },
  { file: "05-pokewatch", path: "/pokewatch", wait: "body" },
  { file: "06-cardlounge-signin", path: "/card-lounge", wait: "body" },
  { file: "07-pricing", path: "/pricing", wait: "body" },
  { file: "08-signin", path: "/sign-in", wait: "body" },
  { file: "09-home-tools", path: "/", wait: "text=CardLounge", scrollY: 420 },
  { file: "10-privacy", path: "/privacy", wait: "body" },
]

async function toStoreSize(inputPath, outputPath) {
  await sharp(inputPath)
    .resize(W, H, {
      fit: "cover",
      position: "top",
      background: { r: 11, g: 14, b: 20, alpha: 1 },
    })
    .png()
    .toFile(outputPath)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  // iPhone 15 Pro Max–class viewport; deviceScaleFactor so CSS px × 3 ≈ store px
  const context = await browser.newContext({
    ...devices["iPhone 15 Pro Max"],
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
  })
  const page = await context.newPage()

  for (const item of PAGES) {
    const url = `${BASE}${item.path}`
    console.log(`capturing ${item.file} ← ${url}`)
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() =>
      page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }),
    )
    await page.waitForTimeout(1200)
    if (item.wait) {
      await page.waitForSelector(item.wait, { timeout: 15000 }).catch(() => {})
    }
    if (item.scrollY) {
      await page.evaluate((y) => window.scrollTo(0, y), item.scrollY)
      await page.waitForTimeout(400)
    }
    const rawPath = join(RAW, `${item.file}.png`)
    await page.screenshot({ path: rawPath, fullPage: false, type: "png" })
    const outPath = join(SHOTS, `${item.file}.png`)
    await toStoreSize(rawPath, outPath)
    console.log(`  → ${outPath}`)
  }

  await browser.close()

  // Try to build 3 short App Preview clips (slideshow MP4) if ffmpeg exists
  const ffmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" })
  if (ffmpeg.status === 0) {
    const previewSets = [
      { name: "preview-01-hub", frames: ["01-home", "09-home-tools", "07-pricing"] },
      { name: "preview-02-tools", frames: ["02-slabcrack", "03-slablab", "04-pokematch"] },
      { name: "preview-03-alerts", frames: ["05-pokewatch", "06-cardlounge-signin", "08-signin"] },
    ]
    for (const set of previewSets) {
      const listFile = join(PREVIEWS, `${set.name}-list.txt`)
      const lines = set.frames.flatMap((f) => [
        `file '${join(SHOTS, `${f}.png`).replace(/\\/g, "/")}'`,
        "duration 3",
      ])
      // last frame must be repeated without duration for concat demuxer
      lines.push(`file '${join(SHOTS, `${set.frames.at(-1)}.png`).replace(/\\/g, "/")}'`)
      writeFileSync(listFile, lines.join("\n"))
      const outMp4 = join(PREVIEWS, `${set.name}.mp4`)
      const args = [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFile,
        "-vf",
        `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outMp4,
      ]
      const run = spawnSync("ffmpeg", args, { encoding: "utf8" })
      if (run.status === 0) console.log(`preview → ${outMp4}`)
      else console.warn(`ffmpeg failed for ${set.name}:`, run.stderr?.slice(-400))
    }
  } else {
    console.log("")
    console.log("NOTE: ffmpeg not installed — screenshots are ready, but App Previews (videos) were skipped.")
    console.log("Install ffmpeg, then re-run this script, OR record 15–30s clips on a phone/simulator.")
    // Still copy a README for manual preview recording
    writeFileSync(
      join(PREVIEWS, "README.md"),
      `# App Previews (videos)

Apple requires **.mp4 / .mov** clips (15–30s), not stills.

Suggested 3 clips:
1. Hub → scroll tools (use 01-home + 09-home-tools)
2. SlabCrack → SlabLab → PokeMatch
3. PokeWatch → CardLounge / Sign in

Record on iPhone with screen recording, or install ffmpeg and re-run:
\`node apps/pc-queue-watch/scripts/capture-store-screenshots.mjs\`
`,
    )
  }

  writeFileSync(
    join(OUT, "README.md"),
    `# CollecTools App Store assets

## Screenshots (10) — iPhone 6.7" (1290×2796)
Upload from \`screenshots/\` in this order:
1. 01-home.png — Hub
2. 02-slabcrack.png
3. 03-slablab.png
4. 04-pokematch.png
5. 05-pokewatch.png
6. 06-cardlounge-signin.png
7. 07-pricing.png
8. 08-signin.png
9. 09-home-tools.png
10. 10-privacy.png

In App Store Connect → App Previews and Screenshots → **iPhone 6.7" Display**.

## App Previews (3)
See \`previews/\`. If empty, record on device (App Previews must be video).
`,
  )

  console.log("\nDone. Upload screenshots from:")
  console.log(SHOTS)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
