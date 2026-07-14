/**
 * Fail fast if the Expo config would produce a Play-rejected Android AAB.
 * Checks versionCode + expo-build-properties target/compile SDK 35.
 */
const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")

const root = path.join(__dirname, "..")
const appJsonPath = path.join(root, "app.json")
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"))
const expo = appJson.expo || {}
const android = expo.android || {}
const plugins = expo.plugins || []

const errors = []

const versionCode = android.versionCode
if (!Number.isInteger(versionCode) || versionCode < 16) {
  errors.push(`android.versionCode must be an integer >= 16 (got ${JSON.stringify(versionCode)})`)
}

const buildPropsEntry = plugins.find(
  (entry) => Array.isArray(entry) && entry[0] === "expo-build-properties"
)
if (!buildPropsEntry) {
  errors.push('Missing "expo-build-properties" config plugin in app.json')
} else {
  const androidProps = (buildPropsEntry[1] && buildPropsEntry[1].android) || {}
  for (const key of ["compileSdkVersion", "targetSdkVersion"]) {
    if (androidProps[key] !== 35) {
      errors.push(`expo-build-properties.android.${key} must be 35 (got ${JSON.stringify(androidProps[key])})`)
    }
  }
}

const pkgPath = path.join(root, "package.json")
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
if (!pkg.dependencies || !pkg.dependencies["expo-build-properties"]) {
  errors.push('package.json is missing dependency "expo-build-properties"')
}

if (errors.length) {
  console.error("ERROR: Android Play config is not ready:")
  for (const err of errors) console.error(`  - ${err}`)
  process.exit(1)
}

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

let resolved
try {
  resolved = JSON.parse(config.stdout)
} catch {
  console.error("ERROR: Could not parse `expo config` JSON output")
  process.exit(1)
}

const resolvedPlugins = resolved.plugins || []
const resolvedBuildProps = resolvedPlugins.find(
  (entry) => Array.isArray(entry) && entry[0] === "expo-build-properties"
)
const resolvedAndroid = (resolvedBuildProps && resolvedBuildProps[1] && resolvedBuildProps[1].android) || {}
if (resolvedAndroid.targetSdkVersion !== 35 || resolvedAndroid.compileSdkVersion !== 35) {
  console.error("ERROR: Resolved Expo config does not target Android API 35")
  console.error(JSON.stringify(resolvedAndroid, null, 2))
  process.exit(1)
}

console.log("Play Android config ok")
console.log(`  version=${expo.version} versionCode=${versionCode}`)
console.log("  compileSdkVersion=35 targetSdkVersion=35 (expo-build-properties)")
