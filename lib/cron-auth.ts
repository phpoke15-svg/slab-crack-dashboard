import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Require CRON_SECRET in production. Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>` when the env var is set.
 * In development, allow unauthenticated calls when the secret is unset.
 */
export function requireCronAuth(request: Request | NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = request.headers.get("authorization")
  const isProd = process.env.NODE_ENV === "production"

  if (!cronSecret) {
    if (isProd) {
      return NextResponse.json(
        {
          error:
            "CRON_SECRET is not configured — refusing unauthenticated cron in production.",
        },
        { status: 503 },
      )
    }
    return null
  }

  if (authHeader === `Bearer ${cronSecret}`) return null

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
