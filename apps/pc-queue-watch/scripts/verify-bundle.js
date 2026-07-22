/**
 * Fail fast when Metro cannot bundle the app (same phase that breaks EAS iOS builds).
 */
const { spawnSync } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")

const root = path.join(__dirname, "..")
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "collectools-bundle-"))

const result = spawnSync(
  "npx",
  ["expo", "export", "--platform", "ios", "--output-dir", outDir],
  {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  },
)

try {
  fs.rmSync(outDir, { recursive: true, force: true })
} catch {
  // ignore cleanup errors
}

if (result.status !== 0) {
  console.error("ERROR: Metro bundle failed (this is what breaks EAS iOS builds):")
  console.error(result.stderr || result.stdout)
  process.exit(1)
}

console.log("Metro bundle ok")
