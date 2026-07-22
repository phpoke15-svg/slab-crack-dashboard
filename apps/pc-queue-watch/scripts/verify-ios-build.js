/**
 * Fail fast before EAS iOS builds when local Expo deps are missing.
 * EAS resolves iOS entitlements locally before upload; without node_modules
 * you get "Cannot find expo-modules-autolinking".
 */
const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")

const root = path.join(__dirname, "..")
const errors = []
const warnings = []

function requirePath(label, relativePath) {
  const fullPath = path.join(root, relativePath)
  if (!fs.existsSync(fullPath)) {
    errors.push(`${label} missing (${relativePath}). Run: cd apps/pc-queue-watch && npm ci`)
  }
}

requirePath("expo package", "node_modules/expo/package.json")
requirePath("expo-modules-autolinking", "node_modules/expo-modules-autolinking/package.json")

const iosPlist = path.join(root, "GoogleService-Info.plist")
if (!fs.existsSync(iosPlist)) {
  warnings.push(
    "GoogleService-Info.plist is missing — push alerts need it. Download from Firebase (see FIREBASE.md).",
  )
}

if (errors.length) {
  console.error("ERROR: iOS build prerequisites are not ready:")
  for (const err of errors) console.error(`  - ${err}`)
  process.exit(1)
}

for (const warn of warnings) console.warn(`WARN: ${warn}`)

const config = spawnSync("npx", ["expo", "config", "--type", "public", "--json"], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
})
if (config.status !== 0) {
  console.error("ERROR: Failed to resolve Expo config")
  console.error(config.stderr || config.stdout)
  process.exit(1)
}

console.log("iOS build config ok")
console.log("  Run builds from apps/pc-queue-watch (not the repo root).")
