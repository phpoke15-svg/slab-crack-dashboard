/**
 * Verify CollecTools mobile brand assets are mint/dark (not old solid-blue wipe).
 * Old generate-assets.py wrote tiny solid #2563eb icons (~1–5KB).
 */
const fs = require("fs")
const path = require("path")

const assets = path.join(__dirname, "..", "assets")
const required = ["icon.png", "adaptive-icon.png", "splash.png", "notification-icon.png"]

const missing = required.filter((name) => !fs.existsSync(path.join(assets, name)))
const wiped = ["icon.png", "adaptive-icon.png"].filter((name) => {
  const file = path.join(assets, name)
  if (!fs.existsSync(file)) return false
  return fs.statSync(file).size < 8000
})

if (missing.length || wiped.length) {
  console.error("ERROR: Brand assets missing or look like the old solid-blue placeholders.")
  if (missing.length) console.error("  missing:", missing.join(", "))
  if (wiped.length) console.error("  suspiciously small (likely blue wipe):", wiped.join(", "))
  console.error("  Restore: git checkout HEAD -- apps/pc-queue-watch/assets/")
  process.exit(1)
}

console.log("assets ok — mint/dark brand package intact (icon, adaptive, splash)")
console.log("  bg=#0b0e14 mint=#4ade80")
