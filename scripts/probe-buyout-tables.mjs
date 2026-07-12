import { readFileSync } from "fs"
import { createClient } from "@supabase/supabase-js"

function loadEnvLocal() {
  const raw = readFileSync(".env.local", "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (!process.env[m[1]]) process.env[m[1]] = v
  }
}

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.log("supabase_env=missing")
  process.exit(1)
}

console.log(`host=${new URL(url).host}`)
console.log(`service_role_len=${key.length}`)

const sb = createClient(url, key, { auth: { persistSession: false } })

const { data, error } = await sb.from("buyout_cards").select("id").limit(3)
console.log(`select_error=${error ? error.message : "none"}`)
console.log(`select_count=${data?.length ?? "null"}`)

const probeId = `__probe_${Date.now()}__`
const { error: upErr } = await sb.from("buyout_cards").upsert({
  id: probeId,
  name: "probe",
  set_name: "probe",
})
console.log(`upsert_error=${upErr ? upErr.message : "none"}`)
if (!upErr) {
  await sb.from("buyout_cards").delete().eq("id", probeId)
  console.log("cleanup=ok")
}

// Known existing table sanity check
const { error: wErr, count } = await sb
  .from("watchlist_cards")
  .select("*", { count: "exact", head: true })
console.log(
  `watchlist_cards=${wErr ? "ERR " + wErr.message : "OK count=" + count}`,
)
