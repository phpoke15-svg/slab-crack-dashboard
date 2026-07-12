/**
 * Trigger Buyout Radar market scan using env already injected
 * (e.g. `vercel env run -e production -- node scripts/run-buyout-scan.mjs`).
 * Does not print secret values.
 */
const host =
  process.env.BUYOUT_SCAN_HOST?.trim() ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
  "www.collectools.app"

const base = host.startsWith("http") ? host : `https://${host}`
const secret = process.env.CRON_SECRET?.trim()
const soldKey = process.env.EBAY_SOLD_API_KEY?.trim()

console.log(`host=${base}`)
console.log(`CRON_SECRET=${secret ? "SET" : "MISSING"}`)
console.log(`EBAY_SOLD_API_KEY=${soldKey ? "SET" : "MISSING"}`)

if (!secret) {
  console.error("CRON_SECRET missing — cannot auth cron route")
  process.exit(1)
}
if (!soldKey) {
  console.error("EBAY_SOLD_API_KEY missing — production scan will fail")
  process.exit(1)
}

const url = `${base.replace(/\/$/, "")}/api/cron/scan-buyout-radar`
console.log(`POST/GET ${url} … (may take several minutes)`)

const started = Date.now()
const res = await fetch(url, {
  method: "GET",
  headers: { Authorization: `Bearer ${secret}` },
})
const text = await res.text()
const elapsedSec = Math.round((Date.now() - started) / 1000)
console.log(`status=${res.status} elapsed=${elapsedSec}s`)

let summary = text.slice(0, 800)
try {
  const json = JSON.parse(text)
  summary = JSON.stringify(
    {
      ok: json.ok,
      error: json.error,
      scannedAt: json.scannedAt,
      cardsTargeted: json.cardsTargeted,
      cardsScanned: json.cardsScanned,
      salesIngested: json.salesIngested,
      alertCount: json.alertCount,
      errorCount: Array.isArray(json.errors) ? json.errors.length : undefined,
      sampleErrors: Array.isArray(json.errors) ? json.errors.slice(0, 3) : undefined,
    },
    null,
    2,
  )
} catch {
  // keep raw slice
}
console.log(summary)
if (!res.ok) process.exit(1)
