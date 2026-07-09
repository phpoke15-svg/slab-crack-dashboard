import { NextResponse } from "next/server"
import { createCrossUserReader } from "@/lib/trade-binder/cross-user-client"
import { checkPokeMatchSetup } from "@/lib/trade-binder/setup-health"
import { isSupabaseConfigured } from "@/lib/supabase/server"

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ready: false,
      checks: [
        {
          id: "env",
          label: "Supabase configuration",
          ok: false,
          detail: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.",
        },
      ],
      setupSql: "supabase/pokematch-setup.sql",
    })
  }

  const supabase = createCrossUserReader()
  if (!supabase) {
    return NextResponse.json({
      ready: false,
      checks: [
        {
          id: "admin",
          label: "Database reader",
          ok: false,
          detail: "Service role client unavailable.",
        },
      ],
      setupSql: "supabase/pokematch-setup.sql",
    })
  }

  const result = await checkPokeMatchSetup(supabase)
  return NextResponse.json(result)
}
