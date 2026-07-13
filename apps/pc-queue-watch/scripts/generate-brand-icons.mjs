/**
 * Generate CollecTools store/app icons to match the website brand mark
 * (rounded dark tile, white C + mint T).
 *
 * Usage (from apps/pc-queue-watch):
 *   node scripts/generate-brand-icons.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const assets = join(__dirname, "..", "assets")
const repoRoot = join(__dirname, "..", "..", "..")
const publicIcon = join(repoRoot, "public", "icon.svg")

const require = createRequire(import.meta.url)
const sharp = (() => {
  try {
    return require("sharp")
  } catch {
    return require(join(repoRoot, "node_modules", "sharp"))
  }
})()

mkdirSync(assets, { recursive: true })

const BG = "#0b0e14"
const WHITE = "#f4f7fb"
const MINT = "#4ade80"
const RING = "rgba(255,255,255,0.12)"

/** Full-bleed store icon (iOS/Android prefer full canvas). */
function iconSvg(size, { rounded = true, ring = true, fontScale = 0.42 } = {}) {
  const rx = rounded ? Math.round(size * 0.22) : 0
  const inset = Math.round(size * 0.02)
  const stroke = Math.max(2, Math.round(size * 0.008))
  const fontSize = Math.round(size * fontScale)
  const baseline = Math.round(size * 0.58)
  const tracking = Math.round(size * -0.016)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${BG}"/>
  ${
    ring
      ? `<rect x="${inset}" y="${inset}" width="${size - inset * 2}" height="${size - inset * 2}" rx="${Math.max(0, rx - inset)}" stroke="${RING}" stroke-width="${stroke}" fill="none"/>`
      : ""
  }
  <text x="${size / 2}" y="${baseline}" text-anchor="middle"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    font-size="${fontSize}" font-weight="800" letter-spacing="${tracking}">
    <tspan fill="${WHITE}">C</tspan><tspan fill="${MINT}">T</tspan>
  </text>
</svg>`
}

/** Android adaptive foreground — CT only on transparent, safe inside ~66% circle. */
function adaptiveForegroundSvg(size) {
  const fontSize = Math.round(size * 0.34)
  const baseline = Math.round(size * 0.58)
  const tracking = Math.round(size * -0.012)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
  <text x="${size / 2}" y="${baseline}" text-anchor="middle"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    font-size="${fontSize}" font-weight="800" letter-spacing="${tracking}">
    <tspan fill="${WHITE}">C</tspan><tspan fill="${MINT}">T</tspan>
  </text>
</svg>`
}

/** Notification small icon — white silhouette on transparent. */
function notificationSvg(size) {
  const fontSize = Math.round(size * 0.55)
  const baseline = Math.round(size * 0.7)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
  <text x="${size / 2}" y="${baseline}" text-anchor="middle"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    font-size="${fontSize}" font-weight="800" fill="#ffffff">CT</text>
</svg>`
}

async function raster(svg, outPath, size) {
  const buf = await sharp(Buffer.from(svg))
    .resize(size, size, { fit: "fill" })
    .png()
    .toBuffer()
  writeFileSync(outPath, buf)
  console.log(`wrote ${outPath} (${buf.length} bytes)`)
}

const icon1024 = iconSvg(1024, { rounded: false, ring: false, fontScale: 0.44 })
const splash1242 = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1242" height="2436" viewBox="0 0 1242 2436" fill="none">
  <rect width="1242" height="2436" fill="${BG}"/>
  <text x="621" y="1260" text-anchor="middle"
    font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    font-size="220" font-weight="800" letter-spacing="-8">
    <tspan fill="${WHITE}">C</tspan><tspan fill="${MINT}">T</tspan>
  </text>
</svg>`

await raster(icon1024, join(assets, "icon.png"), 1024)
await raster(icon1024, join(assets, "icon-source.png"), 1024)
await raster(adaptiveForegroundSvg(1024), join(assets, "adaptive-icon.png"), 1024)
await raster(splash1242, join(assets, "splash.png"), 1242)
await raster(notificationSvg(96), join(assets, "notification-icon.png"), 96)

// Keep website public favicon in sync (rounded tile like header mark)
writeFileSync(
  publicIcon,
  iconSvg(512, { rounded: true, ring: true, fontScale: 0.43 }).replace(
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    "",
  ),
)
console.log(`wrote ${publicIcon}`)
console.log("Brand icons updated to match CollecTools header mark.")
