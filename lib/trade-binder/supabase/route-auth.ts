import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { User } from "@supabase/supabase-js"

export async function createRouteClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Supabase is not configured")

  const cookieStore = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component — cookie writes are ignored.
        }
      },
    },
  })
}

type RouteClient = Awaited<ReturnType<typeof createRouteClient>>

export type AuthResult =
  | { ok: true; user: User; supabase: RouteClient }
  | { ok: false; error: string; status: number }

export async function requireUser(): Promise<AuthResult> {
  const supabase = await createRouteClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return { ok: false, error: "Sign in required", status: 401 }
  return { ok: true, user, supabase }
}
